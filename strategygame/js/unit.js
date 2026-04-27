export class Unit {
    constructor(typeKey, config, x, y, team) {
        this.typeKey = typeKey;
        this.name = config.name;
        this.maxHp = config.hp;
        this.hp = config.hp;
        this.damage = config.damage;
        this.range = config.range;
        this.speed = config.speed;
        this.color = config.color;
        this.icon = config.icon;

        this.x = x;
        this.y = y;
        this.team = team;

        this.target = null;
        this.cooldown = 0;
        this.isAttacking = false;
    }

    takeDamage(amount) {
        this.hp = Math.max(0, this.hp - amount);
    }

    isAlive() {
        return this.hp > 0;
    }

    getDistance(other) {
        return Math.abs(this.x - other.x) + Math.abs(this.y - other.y);
    }

    findTarget(allUnits) {
        let nearest = null;
        let minDist = Infinity;

        for (const unit of allUnits) {
            if (unit.team !== this.team && unit.isAlive()) {
                const dist = this.getDistance(unit);
                if (dist < minDist) {
                    minDist = dist;
                    nearest = unit;
                }
            }
        }
        this.target = nearest;
        return nearest;
    }

    step(allUnits, gridSize) {
        if (!this.isAlive()) return null;

        if (this.cooldown > 0) {
            this.cooldown--;
            return null;
        }

        this.findTarget(allUnits);
        if (!this.target) return null;

        const dist = this.getDistance(this.target);

        if (dist <= this.range) {
            this.target.takeDamage(this.damage);
            this.cooldown = this.speed;
            this.isAttacking = true;
            setTimeout(() => { this.isAttacking = false; }, 200);
            return { type: 'attack', attacker: this, target: this.target };
        } else {
            const dx = this.target.x - this.x;
            const dy = this.target.y - this.y;

            let nextX = this.x;
            let nextY = this.y;

            if (Math.abs(dx) > Math.abs(dy)) {
                nextX += Math.sign(dx);
            } else {
                nextY += Math.sign(dy);
            }

            const occupied = allUnits.some(u => u.isAlive() && u.x === nextX && u.y === nextY);
            if (!occupied && nextX >= 0 && nextX < gridSize && nextY >= 0 && nextY < gridSize) {
                this.x = nextX;
                this.y = nextY;
                return { type: 'move', x: this.x, y: this.y };
            }
        }
        return null;
    }
}
