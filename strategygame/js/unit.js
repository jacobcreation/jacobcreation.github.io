export class Unit {
	static nextId = 1;

	constructor(typeKey, config, x, y, team) {
		this.id = Unit.nextId++;
		this.typeKey = typeKey;
		this.name = config.name;
		this.role = config.role;
		this.description = config.description;
		this.maxHp = config.hp;
		this.hp = config.hp;
		this.damage = config.damage;
		this.range = config.range;
		this.speed = config.speed;
		this.cost = config.cost;
		this.color = config.color;
		this.icon = config.icon;
		this.preferredBand = config.preferredBand || "mid";

		this.x = x;
		this.y = y;
		this.team = team;

		this.target = null;
		this.cooldown = 0;
		this.isAttacking = false;

		this.kills = 0;
		this.attacksMade = 0;
		this.damageDealt = 0;
		this.damageTaken = 0;
	}

	takeDamage(amount) {
		const actualDamage = Math.min(this.hp, amount);
		this.hp = Math.max(0, this.hp - amount);
		this.damageTaken += actualDamage;
		return {
			actualDamage,
			defeated: this.hp <= 0,
		};
	}

	resetForRound() {
		this.hp = this.maxHp;
		this.cooldown = 0;
		this.target = null;
		this.isAttacking = false;
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
			const outcome = this.target.takeDamage(this.damage);
			this.cooldown = this.speed;
			this.isAttacking = true;
			this.attacksMade++;
			this.damageDealt += outcome.actualDamage;

			if (outcome.defeated) {
				this.kills++;
			}

			setTimeout(() => {
				this.isAttacking = false;
			}, 180);

			return {
				type: "attack",
				attacker: this,
				target: this.target,
				damage: outcome.actualDamage,
				defeated: outcome.defeated,
			};
		}

		const dx = this.target.x - this.x;
		const dy = this.target.y - this.y;
		const primaryMoves =
			Math.abs(dx) > Math.abs(dy)
				? [
						{ x: this.x + Math.sign(dx), y: this.y },
						{ x: this.x, y: this.y + Math.sign(dy) },
					]
				: [
						{ x: this.x, y: this.y + Math.sign(dy) },
						{ x: this.x + Math.sign(dx), y: this.y },
					];

		for (const move of primaryMoves) {
			if (move.x === this.x && move.y === this.y) continue;

			const occupied = allUnits.some(
				(unit) =>
					unit.isAlive() &&
					unit.id !== this.id &&
					unit.x === move.x &&
					unit.y === move.y,
			);

			const insideGrid =
				move.x >= 0 && move.x < gridSize && move.y >= 0 && move.y < gridSize;
			if (!occupied && insideGrid) {
				this.x = move.x;
				this.y = move.y;
				return { type: "move", unit: this, x: this.x, y: this.y };
			}
		}

		return null;
	}
}
