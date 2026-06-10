export class Projectile {
    constructor(x, y, target, damage, color, options = {}) {
        this.x = x;
        this.y = y;
        this.target = target;
        this.damage = damage;
        this.color = color;
        this.speed = options.speed || 7;
        this.radius = options.radius || 4;
        this.trailColor = options.trailColor || color;
        this.trailTimer = 0;
        this.isDead = false;
    }

    update(particleSystem) {
        if (this.target.isDead || this.target.reachedEnd) {
            this.isDead = true;
            return;
        }

        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < this.speed) {
            this.target.takeDamage(this.damage, particleSystem);
            this.isDead = true;
        } else {
            this.x += (dx / distance) * this.speed;
            this.y += (dy / distance) * this.speed;
            this.trailTimer++;
            if (this.trailTimer % 3 === 0) {
                particleSystem.addTrail(this.x, this.y, this.trailColor);
            }
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

export class Tower {
    static TYPES = {
        laser: {
            label: 'Laser',
            cost: 100,
            range: 150,
            damage: 15,
            cooldown: 6,
            color: '#00f2ff',
            accent: '#b8fbff',
            projectileSpeed: 12,
            projectileRadius: 4,
            shape: 'spire'
        },
        cannon: {
            label: 'Cannon',
            cost: 175,
            range: 135,
            damage: 42,
            cooldown: 6,
            color: '#ffae00',
            accent: '#ffe29e',
            projectileSpeed: 8.5,
            projectileRadius: 7,
            shape: 'cannon'
        },
        pulse: {
            label: 'Pulse',
            cost: 250,
            range: 120,
            damage: 60,
            cooldown: 6,
            color: '#bd00ff',
            accent: '#f0a3ff',
            projectileSpeed: 10,
            projectileRadius: 6,
            shape: 'dish'
        },
        sniper: {
            label: 'Sniper',
            cost: 325,
            range: 260,
            damage: 92,
            cooldown: 6,
            color: '#ff3864',
            accent: '#ffd1dc',
            projectileSpeed: 18,
            projectileRadius: 3,
            shape: 'rail'
        },
        tesla: {
            label: 'Tesla',
            cost: 400,
            range: 170,
            damage: 34,
            cooldown: 6,
            color: '#35ff8a',
            accent: '#d7ffe7',
            projectileSpeed: 15,
            projectileRadius: 5,
            shape: 'coil'
        }
    };

    static getStats(type) {
        return Tower.TYPES[type] || Tower.TYPES.laser;
    }

    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.stats = Tower.getStats(type);
        this.range = this.stats.range;
        this.damage = this.stats.damage;
        this.cooldown = this.stats.cooldown; // frames
        this.timer = 0;
        this.color = this.stats.color;
        this.target = null;
        this.angle = -Math.PI / 2;
    }

    update(enemies, projectiles, particleSystem) {
        if (this.timer > 0) this.timer--;

        // Find target
        if (!this.target || this.target.isDead || this.target.reachedEnd || this.getDistance(this.target) > this.range) {
            this.target = this.findTarget(enemies);
        }

        if (this.target) {
            this.angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
        }

        if (this.target && this.timer <= 0) {
            this.fire(projectiles);
            this.timer = this.cooldown;
        }
    }

    findTarget(enemies) {
        let bestTarget = null;
        let maxDistance = -1;

        for (const enemy of enemies) {
            const dist = this.getDistance(enemy);
            if (dist <= this.range && enemy.distanceTravelled > maxDistance) {
                maxDistance = enemy.distanceTravelled;
                bestTarget = enemy;
            }
        }
        return bestTarget;
    }

    getDistance(obj) {
        const dx = obj.x - this.x;
        const dy = obj.y - this.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    fire(projectiles) {
        const muzzle = this.getMuzzle();
        projectiles.push(new Projectile(muzzle.x, muzzle.y, this.target, this.damage, this.color, {
            speed: this.stats.projectileSpeed,
            radius: this.stats.projectileRadius,
            trailColor: this.stats.accent
        }));
    }

    getMuzzle() {
        return {
            x: this.x + Math.cos(this.angle) * 24,
            y: this.y + Math.sin(this.angle) * 24
        };
    }

    draw(ctx) {
        ctx.save();
        this.drawBase(ctx);
        this.drawBody(ctx);
        this.drawAim(ctx);
        ctx.restore();
    }

    drawRange(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.range, 0, Math.PI * 2);
        ctx.strokeStyle = this.hexToRgba(this.color, 0.13);
        ctx.stroke();
    }

    drawBase(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = '#10181d';
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.shadowBlur = 12;
        ctx.shadowColor = this.color;

        ctx.beginPath();
        ctx.moveTo(0, -24);
        ctx.lineTo(24, 0);
        ctx.lineTo(0, 24);
        ctx.lineTo(-24, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#06100d';
        ctx.fillRect(-17, 12, 8, 18);
        ctx.fillRect(9, 12, 8, 18);
        ctx.restore();
    }

    drawBody(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.shadowBlur = 16;
        ctx.shadowColor = this.color;

        if (this.stats.shape === 'cannon') {
            this.drawCannon(ctx);
        } else if (this.stats.shape === 'dish') {
            this.drawDish(ctx);
        } else if (this.stats.shape === 'rail') {
            this.drawRailgun(ctx);
        } else if (this.stats.shape === 'coil') {
            this.drawTesla(ctx);
        } else {
            this.drawSpire(ctx);
        }

        ctx.restore();
    }

    drawSpire(ctx) {
        ctx.fillStyle = '#11232a';
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(24, 0);
        ctx.lineTo(-6, -13);
        ctx.lineTo(-14, 0);
        ctx.lineTo(-6, 13);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = this.stats.accent;
        ctx.beginPath();
        ctx.arc(2, 0, 7, 0, Math.PI * 2);
        ctx.fill();
    }

    drawCannon(ctx) {
        ctx.fillStyle = '#21180b';
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 3;
        ctx.fillRect(-8, -12, 30, 24);
        ctx.strokeRect(-8, -12, 30, 24);
        ctx.fillStyle = this.color;
        ctx.fillRect(8, -7, 28, 14);
        ctx.fillStyle = this.stats.accent;
        ctx.fillRect(31, -9, 8, 18);
    }

    drawDish(ctx) {
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(8, 0, 20, -0.85, 0.85);
        ctx.stroke();
        ctx.fillStyle = '#180c24';
        ctx.beginPath();
        ctx.arc(-2, 0, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = this.stats.accent;
        ctx.beginPath();
        ctx.arc(17, 0, 5, 0, Math.PI * 2);
        ctx.fill();
    }

    drawRailgun(ctx) {
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-15, -8);
        ctx.lineTo(34, -8);
        ctx.moveTo(-15, 8);
        ctx.lineTo(34, 8);
        ctx.stroke();
        ctx.fillStyle = '#241017';
        ctx.fillRect(-13, -12, 20, 24);
        ctx.fillStyle = this.stats.accent;
        ctx.fillRect(20, -3, 18, 6);
    }

    drawTesla(ctx) {
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 3;
        for (let i = -12; i <= 12; i += 8) {
            ctx.beginPath();
            ctx.arc(i, 0, 8, Math.PI * 1.2, Math.PI * 2.8);
            ctx.stroke();
        }
        ctx.fillStyle = '#0e2417';
        ctx.beginPath();
        ctx.arc(-7, 0, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = this.stats.accent;
        ctx.beginPath();
        ctx.arc(22, 0, 6, 0, Math.PI * 2);
        ctx.fill();
    }

    drawAim(ctx) {
        if (!this.target) return;

        const muzzle = this.getMuzzle();
        ctx.strokeStyle = this.hexToRgba(this.color, 0.78);
        ctx.lineWidth = this.type === 'sniper' ? 1 : 2;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(muzzle.x, muzzle.y);
        ctx.stroke();
    }

    hexToRgba(hex, alpha) {
        const value = hex.replace('#', '');
        const r = parseInt(value.slice(0, 2), 16);
        const g = parseInt(value.slice(2, 4), 16);
        const b = parseInt(value.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
}
