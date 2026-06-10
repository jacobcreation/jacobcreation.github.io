export class Enemy {
    constructor(path, tileSize, wave, options = {}) {
        this.path = path;
        this.tileSize = tileSize;
        this.waypointIndex = 0;
        
        // Start at first waypoint
        this.x = path[0].x * tileSize + tileSize/2;
        this.y = path[0].y * tileSize + tileSize/2;
        
        this.team = options.team || 'enemy';
        this.targetBaseId = options.targetBaseId || null;
        this.speed = options.speed || 2.4 + (wave * 0.16);
        this.health = options.health || 50 + (wave * 30);
        this.maxHealth = this.health;
        this.color = options.color || (wave % 5 === 0 ? '#ffae00' : '#ff3e3e'); // Boss wave color
        this.radius = options.radius || (wave % 5 === 0 ? 18 : 12);
        this.reward = options.reward ?? 20;
        this.baseDamage = options.baseDamage ?? 1;
        this.trailChance = options.trailChance ?? 0.08;
        this.distanceTravelled = 0;
        this.isDead = false;
        this.reachedEnd = false;
    }

    update(particleSystem) {
        if (this.waypointIndex >= this.path.length - 1) {
            this.reachedEnd = true;
            return;
        }

        const target = this.path[this.waypointIndex + 1];
        const targetX = target.x * this.tileSize + this.tileSize/2;
        const targetY = target.y * this.tileSize + this.tileSize/2;

        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < this.speed) {
            this.x = targetX;
            this.y = targetY;
            this.waypointIndex++;
        } else {
            const vx = (dx / distance) * this.speed;
            const vy = (dy / distance) * this.speed;
            this.x += vx;
            this.y += vy;
            this.distanceTravelled += this.speed;
        }

        // Add small trail
        if (Math.random() < this.trailChance) {
            particleSystem.addTrail(this.x, this.y, this.color);
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        
        // Draw enemy body
        ctx.beginPath();
        if (this.team === 'player') {
            ctx.moveTo(this.x + this.radius, this.y);
            ctx.lineTo(this.x - this.radius * 0.75, this.y - this.radius * 0.75);
            ctx.lineTo(this.x - this.radius * 0.75, this.y + this.radius * 0.75);
            ctx.closePath();
            ctx.fill();
        } else {
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw health bar
        const barWidth = 30;
        const barHeight = 4;
        ctx.fillStyle = '#333';
        ctx.fillRect(this.x - barWidth/2, this.y - 20, barWidth, barHeight);
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(this.x - barWidth/2, this.y - 20, barWidth * (this.health / this.maxHealth), barHeight);
        
        ctx.restore();
    }

    takeDamage(amount, particleSystem) {
        this.health -= amount;
        if (this.health <= 0) {
            this.isDead = true;
            particleSystem.addExplosion(this.x, this.y, this.color, 20);
        }
    }
}
