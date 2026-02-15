import audio from './audio.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false }); // Optimize for no transparency on canvas bg

// UI
const scoreVal = document.getElementById('score-value');
const finalScoreVal = document.getElementById('final-score'); // Note: Need to update HTML for this ID if I removed the old one, but I kept the container structure mostly.
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');

// CONFIG
const GRID_SIZE = 30; // Larger grid for cleaner look
const LOGIC_RATE = 15; // Ticks per second (Gameplay speed)
const STEP_TIME = 1000 / LOGIC_RATE;

class Vector2 {
    constructor(x, y) { this.x = x; this.y = y; }
    add(v) { return new Vector2(this.x + v.x, this.y + v.y); }
    sub(v) { return new Vector2(this.x - v.x, this.y - v.y); }
    mult(s) { return new Vector2(this.x * s, this.y * s); }
    equals(v) { return this.x === v.x && this.y === v.y; }
    lerp(v, t) { return new Vector2(this.x + (v.x - this.x) * t, this.y + (v.y - this.y) * t); }
    dist(v) { return Math.sqrt(Math.pow(v.x - this.x, 2) + Math.pow(v.y - this.y, 2)); }
}

class Particle {
    constructor(x, y, color) {
        this.pos = new Vector2(x, y);
        this.vel = new Vector2((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10);
        this.color = color;
        this.life = 1.0;
        this.decay = 0.01 + Math.random() * 0.02;
    }
    update() {
        this.pos = this.pos.add(this.vel);
        this.vel = this.vel.mult(0.92); // Drag
        this.life -= this.decay;
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, 1 + 3 * this.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

class LivingGrid {
    constructor(w, h) {
        this.width = w;
        this.height = h;
        this.nodes = [];
        this.init();
    }

    init() {
        this.gap = GRID_SIZE;
        this.cols = Math.ceil(this.width / this.gap);
        this.rows = Math.ceil(this.height / this.gap);

        for (let y = 0; y <= this.rows; y++) {
            for (let x = 0; x <= this.cols; x++) {
                this.nodes.push({
                    baseX: x * this.gap,
                    baseY: y * this.gap,
                    x: x * this.gap,
                    y: y * this.gap,
                    vx: 0,
                    vy: 0
                });
            }
        }
    }

    update(attractor) {
        // Simple spring physics for grid warp
        for (let node of this.nodes) {
            // Pull towards base
            const ax = (node.baseX - node.x) * 0.05;
            const ay = (node.baseY - node.y) * 0.05;

            node.vx += ax;
            node.vy += ay;
            node.vx *= 0.8; // Damp
            node.vy *= 0.8;

            // Push away from attractor (Snake Head)
            if (attractor) {
                const dist = Math.hypot(node.x - attractor.x, node.y - attractor.y);
                if (dist < 150) {
                    const force = (150 - dist) / 150;
                    const angle = Math.atan2(node.y - attractor.y, node.x - attractor.x);
                    node.vx += Math.cos(angle) * force * 2;
                    node.vy += Math.sin(angle) * force * 2;
                }
            }

            node.x += node.vx;
            node.y += node.vy;
        }
    }

    draw(ctx) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.lineWidth = 1;
        ctx.beginPath();

        // Draw horizontal lines (naive) - optimizing: just dots or key lines
        // For performance, let's just draw dots for the "Modern" feel, cleaner than lines
        for (let node of this.nodes) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.fillRect(node.x - 1, node.y - 1, 2, 2);
        }

        // Connect a few localized lines near attractor for effect? No, simple dots is cleaner.
    }
}

class Snake {
    constructor(gridW, gridH) {
        this.gridW = gridW;
        this.gridH = gridH;
        this.reset();
    }

    reset() {
        this.body = [
            new Vector2(5, 5),
            new Vector2(4, 5),
            new Vector2(3, 5),
            new Vector2(2, 5)
        ];
        // Previous body state for interpolation
        this.prevBody = this.body.map(v => new Vector2(v.x, v.y));

        this.dir = new Vector2(1, 0);
        this.nextDir = new Vector2(1, 0);
        this.growing = false;
    }

    direction(x, y) {
        if (this.dir.x === -x && this.dir.y === -y) return;
        this.nextDir = new Vector2(x, y);
    }

    tick() {
        // Save current state as prev
        this.prevBody = this.body.map(v => new Vector2(v.x, v.y));

        // Move
        this.dir = this.nextDir;
        let head = this.body[0];
        let newHead = head.add(this.dir);

        // Wrap Logic
        if (newHead.x < 0) newHead.x = this.gridW - 1;
        if (newHead.x >= this.gridW) newHead.x = 0;
        if (newHead.y < 0) newHead.y = this.gridH - 1;
        if (newHead.y >= this.gridH) newHead.y = 0;

        // Check Collision PRE-move (Self only now)
        if (this.checkCollision(newHead)) {
            return { gameOver: true };
        }

        this.body.unshift(newHead);

        if (!this.growing) {
            this.body.pop();
        } else {
            this.growing = false;
        }

        return { gameOver: false, head: newHead };
    }

    checkCollision(pos) {
        // Self
        for (let i = 0; i < this.body.length - 1; i++) {
            if (pos.equals(this.body[i])) return true;
        }
        return false;
    }

    grow() {
        this.growing = true;
    }

    getHeadRenderPos(alpha) {
        // Interpolation needs to handle wrap? 
        // For simplicity in Head tracking, just use raw pos. 
        // If wrapping, the lerp might be weird, but acceptable for LivingGrid target.
        return this.body[0].mult(GRID_SIZE).add(new Vector2(GRID_SIZE / 2, GRID_SIZE / 2));
    }

    // Custom draw loop to handle wrapping cuts
    draw(ctx, alpha) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const drawPass = (color, blur, width) => {
            ctx.shadowBlur = blur;
            ctx.shadowColor = color;
            ctx.strokeStyle = color;
            ctx.lineWidth = width;

            ctx.beginPath();

            // Head
            let headPrev = this.prevBody[0];
            let headCurr = this.body[0];

            if (headPrev.dist(headCurr) > 2) {
                // Wrapped recently, don't interpolate
                let p = headCurr.mult(GRID_SIZE).add(new Vector2(GRID_SIZE / 2, GRID_SIZE / 2));
                ctx.moveTo(p.x, p.y);
            } else {
                let p = headPrev.lerp(headCurr, alpha).mult(GRID_SIZE).add(new Vector2(GRID_SIZE / 2, GRID_SIZE / 2));
                ctx.moveTo(p.x, p.y);
            }

            for (let i = 0; i < this.body.length - 1; i++) {
                // Segment from i to i+1
                // We actually want to render the continuous snake.
                // The snake is defined by nodes. We draw lines between them.

                // Curr Node i
                let currNode = this.body[i];
                let prevNode = this.prevBody[Math.min(i, this.prevBody.length - 1)];
                let p1 = (currNode.dist(prevNode) > 2) ? currNode : prevNode.lerp(currNode, alpha);

                // Next Node i+1
                let nextNodeIdx = i + 1;
                let nextNode = this.body[nextNodeIdx];
                let nextNodePrev = this.prevBody[Math.min(nextNodeIdx, this.prevBody.length - 1)];
                let p2 = (nextNode.dist(nextNodePrev) > 2) ? nextNode : nextNodePrev.lerp(nextNode, alpha);

                // If p1 and p2 are far apart (wrap), don't draw line
                if (p1.dist(p2) > 2) {
                    ctx.stroke();
                    ctx.beginPath();
                    let px = p2.mult(GRID_SIZE).add(new Vector2(GRID_SIZE / 2, GRID_SIZE / 2));
                    ctx.moveTo(px.x, px.y);
                } else {
                    let px = p2.mult(GRID_SIZE).add(new Vector2(GRID_SIZE / 2, GRID_SIZE / 2));
                    ctx.lineTo(px.x, px.y);
                }
            }
            ctx.stroke();
        };

        // Glow Pass
        drawPass('#0ff', 30, GRID_SIZE * 0.8);
        // Core Pass
        drawPass('#fff', 0, GRID_SIZE * 0.3);
    }
}

class Food {
    constructor(gridW, gridH) {
        this.gridW = gridW;
        this.gridH = gridH;
        this.pos = new Vector2(10, 10);
        this.reposition(new Snake(1, 1).body); // Temp init
    }

    reposition(excludeBody) {
        let valid = false;
        while (!valid) {
            this.pos.x = Math.floor(Math.random() * this.gridW);
            this.pos.y = Math.floor(Math.random() * this.gridH);
            valid = true;
            // Simple collision check
            for (let b of excludeBody) {
                if (b.x === this.pos.x && b.y === this.pos.y) valid = false;
            }
        }
    }

    draw(ctx, time) {
        let center = this.pos.mult(GRID_SIZE).add(new Vector2(GRID_SIZE / 2, GRID_SIZE / 2));
        let scale = 1 + Math.sin(time / 200) * 0.2;

        ctx.shadowBlur = 40;
        ctx.shadowColor = '#f0f'; // Neon Pink
        ctx.fillStyle = '#f0f';

        ctx.beginPath();
        ctx.arc(center.x, center.y, (GRID_SIZE / 3) * scale, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(center.x, center.y, (GRID_SIZE / 6) * scale, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Game {
    constructor() {
        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.grid = new LivingGrid(canvas.width, canvas.height);
        this.snake = new Snake(this.gridCols, this.gridRows);
        this.food = new Food(this.gridCols, this.gridRows);
        this.particles = [];

        this.score = 0;
        this.state = 'MENU';

        this.lastTime = 0;
        this.accumulator = 0;

        this.bindInput();
        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);
    }

    resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        this.gridCols = Math.floor(canvas.width / GRID_SIZE);
        this.gridRows = Math.floor(canvas.height / GRID_SIZE);
        // If mid-game, might need to clamp snake? Ignore for now.
        if (this.grid) this.grid.init();
    }

    bindInput() {
        document.addEventListener('keydown', (e) => {
            if (this.state === 'MENU' || this.state === 'GAMEOVER') {
                if (e.code === 'Space') this.startGame();
            } else if (this.state === 'PLAYING') {
                if (e.key === 'ArrowUp' || e.key === 'w') this.snake.direction(0, -1);
                if (e.key === 'ArrowDown' || e.key === 's') this.snake.direction(0, 1);
                if (e.key === 'ArrowLeft' || e.key === 'a') this.snake.direction(-1, 0);
                if (e.key === 'ArrowRight' || e.key === 'd') this.snake.direction(1, 0);
            }
        });
    }

    startGame() {
        this.snake.gridW = this.gridCols; // Update in case of resize
        this.snake.gridH = this.gridRows;
        this.food.gridW = this.gridCols;
        this.food.gridH = this.gridRows;

        this.snake.reset();
        this.food.reposition(this.snake.body);
        this.score = 0;
        scoreVal.innerText = '0';

        this.state = 'PLAYING';
        startScreen.classList.remove('active');
        startScreen.classList.add('hidden');
        gameOverScreen.classList.remove('active');
        gameOverScreen.classList.add('hidden');

        audio.ctx.resume();
        audio.startAmbience();
        audio.playStart();
    }

    gameOver() {
        this.state = 'GAMEOVER';
        audio.playDie();
        gameOverScreen.classList.remove('hidden');
        gameOverScreen.classList.add('active');
        // Update final score text if element exists
        const fs = document.querySelector('#game-over-screen p span');
        if (fs) fs.innerText = this.score;
    }

    tick() {
        if (this.state !== 'PLAYING') return;

        const res = this.snake.tick();

        if (res.gameOver) {
            this.handleDeath();
        } else {
            // Check Food
            if (res.head.equals(this.food.pos)) {
                this.snake.grow();
                this.food.reposition(this.snake.body);
                this.score++;
                scoreVal.innerText = this.score;
                audio.playEat();

                // Spawn particles
                const center = this.food.pos.mult(GRID_SIZE).add(new Vector2(GRID_SIZE / 2, GRID_SIZE / 2));
                for (let i = 0; i < 30; i++) {
                    this.particles.push(new Particle(center.x, center.y, '#f0f'));
                }
            }
        }
    }

    update(dt) {
        // Visual updates only
        if (this.state === 'PLAYING') {
            // Get interpolated head pos for grid attractor
            const headPx = this.snake.body[0].mult(GRID_SIZE);
            this.grid.update(headPx);
        } else {
            this.grid.update(null);
        }

        // Particles
        this.particles.forEach(p => p.update());
        this.particles = this.particles.filter(p => p.life > 0);
    }

    draw(alpha) {
        // Clear logic
        ctx.fillStyle = '#000'; // Hard clear
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        this.grid.draw(ctx);

        if (this.state === 'PLAYING' || this.state === 'GAMEOVER' || this.state === 'INPUT_SCORE') {
            this.food.draw(ctx, performance.now());
            this.snake.draw(ctx, alpha);
        }

        // Particles
        ctx.globalCompositeOperation = 'lighter';
        this.particles.forEach(p => p.draw(ctx));
        ctx.globalCompositeOperation = 'source-over';

        // REMOVED VIGNETTE PASS
    }

    loop(time) {
        let dt = time - this.lastTime;
        this.lastTime = time;
        if (dt > 100) dt = 100; // Cap lag

        this.accumulator += dt;

        while (this.accumulator >= STEP_TIME) {
            this.tick();
            this.accumulator -= STEP_TIME;
        }

        const alpha = this.accumulator / STEP_TIME;

        this.update(dt);
        this.draw(alpha);

        requestAnimationFrame(this.loop);
    }

    // Leaderboard Logic
    handleDeath() {
        audio.playDie();

        if (Leaderboard.isHighScore(this.score)) {
            this.state = 'INPUT_SCORE';
            this.showHighScoreScreen();
        } else {
            this.gameOver();
        }
    }

    showHighScoreScreen() {
        // Hide others?
        document.getElementById('highscore-screen').classList.remove('hidden');
        document.getElementById('highscore-screen').classList.add('active');
        const input = document.getElementById('name-input');
        input.value = '';
        input.focus();

        // Ensure one-time listener for enter
        const onEnter = (e) => {
            if (e.key === 'Enter') {
                const name = input.value.toUpperCase() || 'UNK';
                Leaderboard.save(name, this.score);
                input.removeEventListener('keydown', onEnter);

                document.getElementById('highscore-screen').classList.remove('active');
                document.getElementById('highscore-screen').classList.add('hidden');

                this.gameOver();
            }
        };
        input.addEventListener('keydown', onEnter);
    }
}

class Leaderboard {
    static getScores() {
        const stored = localStorage.getItem('snake_scores');
        return stored ? JSON.parse(stored) : [
            { name: 'NEO', score: 50 },
            { name: 'TRN', score: 30 },
            { name: 'MRF', score: 10 }
        ];
    }

    static save(name, score) {
        let scores = this.getScores();
        scores.push({ name, score });
        scores.sort((a, b) => b.score - a.score);
        scores = scores.slice(0, 5); // Keep top 5
        localStorage.setItem('snake_scores', JSON.stringify(scores));

        this.updateUI();
    }

    static isHighScore(score) {
        const scores = this.getScores();
        if (scores.length < 5) return true;
        return score > scores[scores.length - 1].score;
    }

    static updateUI() {
        const list = document.getElementById('leaderboard-list');
        if (!list) return;
        const scores = this.getScores();
        list.innerHTML = scores.map(s =>
            `<li><span>${s.name}</span> <span>${s.score}</span></li>`
        ).join('');
    }
}

// Init Leaderboard UI on load
Leaderboard.updateUI();
new Game();
