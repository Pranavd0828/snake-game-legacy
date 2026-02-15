import audio from './audio.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false }); // Optimize for no transparency on canvas bg

// UI
const scoreVal = document.getElementById('score-value');
const finalScoreVal = document.getElementById('final-score'); // Note: Need to update HTML for this ID if I removed the old one, but I kept the container structure mostly.
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');

// CONFIG
const GRID_SIZE = 20; // Reverted to standard size for better proportion
const LOGIC_RATE = 15;
const STEP_TIME = 1000 / LOGIC_RATE;

// ... (classes omitted for brevity, logic remains same)

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

const POWERUPS = {
    SLOW_MO: { color: '#00ffff', duration: 5000, label: 'SLOW' },
    MAGNET: { color: '#ff00ff', duration: 8000, label: 'MAG' },
    GHOST: { color: '#ffffff', duration: 5000, label: 'GHOST' },
    DOUBLE: { color: '#ffd700', duration: 10000, label: '2X' }
};

class PowerUp {
    constructor(x, y, type) {
        this.pos = new Vector2(x, y);
        this.type = type;
        this.typeInfo = POWERUPS[type];
        this.pulse = 0;
    }

    draw(ctx, time) {
        const cx = this.pos.x * GRID_SIZE + GRID_SIZE / 2;
        const cy = this.pos.y * GRID_SIZE + GRID_SIZE / 2;

        ctx.save();
        ctx.translate(cx, cy);

        // Pulse effect
        const scale = 1 + Math.sin(time * 0.01) * 0.2;
        ctx.scale(scale, scale);

        // Glow
        ctx.shadowBlur = 20;
        ctx.shadowColor = this.typeInfo.color;

        // Shape (Diamond)
        ctx.fillStyle = this.typeInfo.color;
        ctx.beginPath();
        ctx.moveTo(0, -GRID_SIZE / 3);
        ctx.lineTo(GRID_SIZE / 3, 0);
        ctx.lineTo(0, GRID_SIZE / 3);
        ctx.lineTo(-GRID_SIZE / 3, 0);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }
}

class Game {
    constructor() {
        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.state = 'MENU'; // MENU, PLAYING, GAMEOVER, INPUT_SCORE
        this.score = 0;
        this.highScore = localStorage.getItem('snake_highscore') || 0;

        // gridCols/Rows set in resize()

        this.snake = new Snake(this.gridCols, this.gridRows);
        this.food = new Food(this.gridCols, this.gridRows);
        this.particles = [];
        this.powerUps = []; // Active items on map

        this.effects = {
            slowMo: 0,
            magnet: 0,
            ghost: 0,
            double: 0
        };

        // Initialize grid with logical size (CSS pixels), not physical pixels
        // The context scale handles the DPI
        this.grid = new LivingGrid(canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1));

        this.lastTime = 0;
        this.accumulator = 0;

        // Audio Viz State
        this.beatScale = 1.0;
        this.audioEnabled = false;

        this.bindInput();

        // Link Audio Beat
        audio.onBeat = (type) => this.handleBeat(type);

        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);
    }

    resize() {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;

        // Scale context to match DPI
        ctx.resetTransform(); // Reset before scaling
        ctx.scale(dpr, dpr);

        // Grid calculations use CSS pixels
        this.gridCols = Math.floor(window.innerWidth / GRID_SIZE);
        this.gridRows = Math.floor(window.innerHeight / GRID_SIZE);

        if (this.grid) {
            this.grid.width = window.innerWidth;
            this.grid.height = window.innerHeight;
            this.grid.init();
        }
        if (this.snake) {
            this.snake.gridW = this.gridCols;
            this.snake.gridH = this.gridRows;
        }
        if (this.food) {
            this.food.gridW = this.gridCols;
            this.food.gridH = this.gridRows;
        }
    }

    handleBeat(type) {
        if (type === 'KICK') {
            this.beatScale = 1.2; // Pulse grid
            // Screen shake or bloom boost could go here
        }
    }



    bindInput() {
        // Keyboard
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

        // Touch
        document.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        document.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });
    }

    handleTouchStart(e) {
        const touch = e.touches[0];
        this.touchStartX = touch.clientX;
        this.touchStartY = touch.clientY;

        if (this.state === 'MENU' || this.state === 'GAMEOVER') {
            this.isTap = true;
        }
    }

    handleTouchEnd(e) {
        if (this.state === 'MENU' || this.state === 'GAMEOVER') {
            const touch = e.changedTouches[0];
            const dx = touch.clientX - this.touchStartX;
            const dy = touch.clientY - this.touchStartY;

            if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
                this.startGame();
                return;
            }
        }

        if (this.state !== 'PLAYING') return;

        const touch = e.changedTouches[0];
        const diffX = touch.clientX - this.touchStartX;
        const diffY = touch.clientY - this.touchStartY;

        if (Math.abs(diffX) < 30 && Math.abs(diffY) < 30) return;

        if (Math.abs(diffX) > Math.abs(diffY)) {
            if (diffX > 0) this.snake.direction(1, 0);
            else this.snake.direction(-1, 0);
        } else {
            if (diffY > 0) this.snake.direction(0, 1);
            else this.snake.direction(0, -1);
        }
    }

    startGame() {
        if (!this.audioEnabled) {
            audio.startMusic();
            this.audioEnabled = true;
        }

        this.snake.gridW = this.gridCols; // Update in case of resize
        this.snake.gridH = this.gridRows;
        this.food.gridW = this.gridCols;
        this.food.gridH = this.gridRows;

        this.snake.reset();
        this.food.reposition(this.snake.body);
        this.score = 0;
        scoreVal.innerText = '0';

        this.powerUps = [];
        this.effects = { slowMo: 0, magnet: 0, ghost: 0, double: 0 };

        this.state = 'PLAYING';
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden')); // Ensure all are hidden

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

        // MAGNET EFFECT
        if (this.effects.magnet > 0) {
            const head = this.snake.body[0];
            const dist = head.dist(this.food.pos);
            if (dist < 5) { // Range
                // Move food towards snake
                this.food.pos.x += (head.x - this.food.pos.x) * 0.1;
                this.food.pos.y += (head.y - this.food.pos.y) * 0.1;
                // Clamp to grid approximate
            }
        }

        // Apply Timers
        for (let key in this.effects) {
            if (this.effects[key] > 0) this.effects[key] -= STEP_TIME;
        }

        // Spawn PowerUp Chance
        if (Math.random() < 0.005 && this.powerUps.length < 2) { // 0.5% per frame
            this.spawnPowerUp();
        }

        const res = this.snake.tick();

        // Check Self Collision (unless GHOST)
        if (res.gameOver && this.effects.ghost <= 0) {
            this.handleDeath();
            return;
        } else if (res.gameOver && this.effects.ghost > 0) {
            // Check walls still kill? No, we have wrapping. 
            // Self collision is the only thing tick() returns as gameOver usually.
            // So we ignore it.
        }

        // Check Food
        // Simple distance check incase magnet pulled it off-grid
        const headPixel = this.snake.body[0].mult(GRID_SIZE);
        const foodPixel = this.food.pos.mult(GRID_SIZE);
        if (headPixel.dist(foodPixel) < GRID_SIZE) {
            this.snake.grow();
            this.food.reposition(this.snake.body);

            let points = 1;
            if (this.effects.double > 0) points = 2;
            this.score += points;
            scoreVal.innerText = this.score;
            audio.playEat();

            const center = this.food.pos.mult(GRID_SIZE).add(new Vector2(GRID_SIZE / 2, GRID_SIZE / 2));
            for (let i = 0; i < 30; i++) {
                this.particles.push(new Particle(center.x, center.y, '#f0f'));
            }
        }

        // Check PowerUps
        for (let i = this.powerUps.length - 1; i >= 0; i--) {
            const p = this.powerUps[i];
            const pPixel = p.pos.mult(GRID_SIZE);
            if (headPixel.dist(pPixel) < GRID_SIZE) {
                this.activateEffect(p.type);
                this.powerUps.splice(i, 1);
                audio.playPowerUp();
            }
        }
    }

    spawnPowerUp() {
        const types = Object.keys(POWERUPS);
        const type = types[Math.floor(Math.random() * types.length)];
        // Random pos
        const x = Math.floor(Math.random() * this.gridCols);
        const y = Math.floor(Math.random() * this.gridRows);
        this.powerUps.push(new PowerUp(x, y, type));
    }

    activateEffect(type) {
        const info = POWERUPS[type];
        if (type === 'SLOW_MO') this.effects.slowMo = info.duration;
        if (type === 'MAGNET') this.effects.magnet = info.duration;
        if (type === 'GHOST') this.effects.ghost = info.duration;
        if (type === 'DOUBLE') this.effects.double = info.duration;
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

        // Audio Beat Decay
        this.beatScale += (1.0 - this.beatScale) * 0.1;

        // Particles
        this.particles.forEach(p => p.update());
        this.particles = this.particles.filter(p => p.life > 0);
    }

    draw(alpha) {
        // Clear logic
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Grid with Beat Scale
        ctx.save();
        // Center zoom
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(this.beatScale, this.beatScale);
        ctx.translate(-canvas.width / 2, -canvas.height / 2);
        this.grid.draw(ctx);
        ctx.restore();

        if (this.state === 'PLAYING' || this.state === 'GAMEOVER' || this.state === 'INPUT_SCORE') {
            this.food.draw(ctx, performance.now());

            // Draw PowerUps
            this.powerUps.forEach(p => p.draw(ctx, performance.now()));

            // Snake visual feedback for effects
            if (this.effects.ghost > 0) ctx.globalAlpha = 0.5;
            this.snake.draw(ctx, alpha);
            ctx.globalAlpha = 1.0;
        }

        // Particles
        ctx.globalCompositeOperation = 'lighter';
        this.particles.forEach(p => p.draw(ctx));
        ctx.globalCompositeOperation = 'source-over';

        // Draw Active Effects UI
        this.drawEffectsUI();
    }

    drawEffectsUI() {
        if (this.state !== 'PLAYING') return;

        let y = 100;
        for (let key in this.effects) {
            if (this.effects[key] > 0) {
                const ratio = this.effects[key]; // ms
                const label = POWERUPS[key.toUpperCase()] ? POWERUPS[key.toUpperCase()].label : key.toUpperCase(); // Use label from POWERUPS

                ctx.fillStyle = '#fff';
                ctx.font = '16px "Orbitron"';
                ctx.fillText(label, 20, y);

                // Bar
                ctx.fillStyle = '#fff';
                ctx.fillRect(80, y - 10, ratio * 0.01, 10);

                y += 30;
            }
        }
    }

    loop(time) {
        let dt = time - this.lastTime;
        this.lastTime = time;
        if (dt > 100) dt = 100; // Cap lag

        this.accumulator += dt;

        // Dynamic speed based on slow-mo
        let currentStep = STEP_TIME;
        if (this.effects.slowMo > 0) currentStep = STEP_TIME * 1.5; // Slower

        while (this.accumulator >= currentStep) {
            this.tick();
            this.accumulator -= currentStep;
        }

        const alpha = this.accumulator / currentStep;

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
        document.getElementById('highscore-screen').classList.remove('hidden');
        document.getElementById('highscore-screen').classList.add('active');
        const input = document.getElementById('name-input');
        input.value = '';
        input.focus();

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
