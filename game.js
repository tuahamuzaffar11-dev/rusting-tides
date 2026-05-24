'use strict';

// â”€â”€â”€ HELPERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function aabbCollision(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function removeWhiteBackground(img) {
  try {
    const c = document.createElement('canvas');
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (w <= 0 || h <= 0) return img;
    
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    
    const visited = new Uint8Array(w * h);
    const queue = [];
    
    const isNearWhite = (idx) => {
      const r = data[idx];
      const g = data[idx+1];
      const b = data[idx+2];
      const a = data[idx+3];
      return a > 0 && r > 230 && g > 230 && b > 230;
    };
    
    for (let x = 0; x < w; x++) {
      let idx = x * 4;
      if (isNearWhite(idx)) {
        queue.push(x, 0);
        visited[x] = 1;
      }
      idx = ((h - 1) * w + x) * 4;
      if (isNearWhite(idx)) {
        queue.push(x, h - 1);
        visited[(h - 1) * w + x] = 1;
      }
    }
    for (let y = 0; y < h; y++) {
      let idx = (y * w) * 4;
      if (isNearWhite(idx)) {
        queue.push(0, y);
        visited[y * w] = 1;
      }
      idx = (y * w + w - 1) * 4;
      if (isNearWhite(idx)) {
        queue.push(w - 1, y);
        visited[y * w + w - 1] = 1;
      }
    }
    
    let head = 0;
    const dirs = [-1, 0, 1, 0, 0, -1, 0, 1];
    while (head < queue.length) {
      const cx = queue[head++];
      const cy = queue[head++];
      
      const idx = (cy * w + cx) * 4;
      data[idx+3] = 0;
      
      for (let d = 0; d < 8; d += 2) {
        const nx = cx + dirs[d];
        const ny = cy + dirs[d+1];
        if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
          const nidx = ny * w + nx;
          if (!visited[nidx]) {
            visited[nidx] = 1;
            if (isNearWhite(nidx * 4)) {
              queue.push(nx, ny);
            }
          }
        }
      }
    }
    
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] === 255 && data[i+1] === 255 && data[i+2] === 255) {
        data[i+3] = 0;
      }
    }
    
    ctx.putImageData(imgData, 0, 0);
    const newImg = new Image();
    newImg.src = c.toDataURL();
    return newImg;
  } catch (e) {
    console.error("Error removing background from sprite", e);
    return img;
  }
}

// â”€â”€â”€ CLASS 1: Fighter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class Fighter {
  constructor(config) {
    this.x = config.x;
    this.y = config.y;
    this.name = config.name;
    this.isPlayer = config.isPlayer;
    this.hp = config.maxHp;
    this.maxHp = config.maxHp;
    this.sprite = config.sprite;
    this.width = config.width || 80;
    this.height = config.height || 120;
    this.facing = config.facing || 1;
    this.vx = 0;
    this.vy = 0;
    this.state = 'idle';
    this.stateTimer = 0;
    this.attackPhase = null;
    this.attackType = null;
    this.attackTimer = 0;
    this.hitCooldown = 0;
    this.dodgeTimer = 0;
    this.flashTimer = 0;
    this.groundY = config.y;
    this.aiTimer = 0;
    this.aiDecision = 'idle';
    this.bobTimer = 0;

    this.speedMultiplier = config.speedMultiplier || 1.0;

    this._startX = config.x;
    this._startY = config.y;
    this._startFacing = config.facing || 1;
  }

  // â”€â”€ update â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  update(dt, keys, opponent, arenaLeft, arenaRight) {
    this.bobTimer += dt;
    if (this.hitCooldown > 0) this.hitCooldown -= dt;
    if (this.flashTimer > 0) this.flashTimer -= dt;

    if (this.isPlayer) {
      this._updatePlayer(dt, keys, opponent, arenaLeft, arenaRight);
    } else {
      this._updateAI(dt, opponent, arenaLeft, arenaRight);
    }

    if (!this.history) this.history = [];
    this.history.push({
      x: this.x,
      y: this.y,
      bob: Math.sin(this.bobTimer * 3) * 2,
      facing: this.facing,
      state: this.state,
      attackPhase: this.attackPhase,
      attackType: this.attackType,
      attackTimer: this.attackTimer
    });
    if (this.history.length > 5) this.history.shift();
  }

  // â”€â”€ player update â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  _updatePlayer(dt, keys, opponent, arenaLeft, arenaRight) {
    // hit stun
    if (this.state === 'hit') {
      this.stateTimer -= dt;
      this.vx *= 0.9;
      this.x += this.vx * dt;
      this.x = Math.max(arenaLeft, Math.min(arenaRight, this.x));
      if (this.stateTimer <= 0) {
        this.state = 'idle';
        this.attackPhase = null;
        this.attackType = null;
      }
      return;
    }

    // dodge
    if (this.state === 'dodging') {
      this.dodgeTimer -= dt;
      this.x += this.vx * dt;
      this.x = Math.max(arenaLeft, Math.min(arenaRight, this.x));
      if (this.dodgeTimer <= 0) {
        this.state = 'idle';
        this.vx = 0;
      }
      return;
    }

    // attacking
    if (this.state === 'attacking_light' || this.state === 'attacking_heavy') {
      this.attackTimer -= dt;
      this.vx *= 0.9;
      this.x += this.vx * dt;
      this.x = Math.max(arenaLeft, Math.min(arenaRight, this.x));

      if (this.state === 'attacking_light') {
        const total = 0.4;
        const elapsed = total - this.stateTimer + (this.stateTimer - this.attackTimer);
        const age = 0.4 - this.attackTimer;
        if (age < 0.1) {
          this.attackPhase = 'windup';
        } else if (age < 0.25) {
          this.attackPhase = 'active';
        } else {
          this.attackPhase = 'recovery';
        }
        if (this.attackTimer <= 0) {
          this.state = 'idle';
          this.attackPhase = null;
          this.attackType = null;
        }
      } else {
        const age = 0.7 - this.attackTimer;
        if (age < 0.2) {
          this.attackPhase = 'windup';
        } else if (age < 0.4) {
          this.attackPhase = 'active';
        } else {
          this.attackPhase = 'recovery';
        }
        if (this.attackTimer <= 0) {
          this.state = 'idle';
          this.attackPhase = null;
          this.attackType = null;
        }
      }
      return;
    }

    // blocking
    if (keys.block) {
      this.state = 'blocking';
      this.vx *= 0.8;
      this.x += this.vx * dt;
      this.x = Math.max(arenaLeft, Math.min(arenaRight, this.x));
      this.facing = opponent.x > this.x ? 1 : -1;
      return;
    } else if (this.state === 'blocking') {
      this.state = 'idle';
    }

    // face opponent
    this.facing = opponent.x > this.x ? 1 : -1;

    // dodge input (single press)
    if (keys.dodge) {
      this.state = 'dodging';
      this.dodgeTimer = 0.4;
      this.vx = this.facing * 500;
      return;
    }

    // light attack (single press)
    if (keys.lightAttack) {
      this.state = 'attacking_light';
      this.attackType = 'light';
      this.attackTimer = 0.4;
      this.attackPhase = 'windup';
      this.hitCooldown = 0;
      return;
    }

    // heavy attack (single press)
    if (keys.heavyAttack) {
      this.state = 'attacking_heavy';
      this.attackType = 'heavy';
      this.attackTimer = 0.7;
      this.attackPhase = 'windup';
      this.hitCooldown = 0;
      return;
    }

    // movement
    if (keys.left) {
      this.vx = -300;
    } else if (keys.right) {
      this.vx = 300;
    } else {
      this.vx *= 0.85;
      if (Math.abs(this.vx) < 5) this.vx = 0;
    }

    this.x += this.vx * dt;
    this.x = Math.max(arenaLeft, Math.min(arenaRight, this.x));
    this.state = Math.abs(this.vx) > 10 ? 'walking' : 'idle';
  }

  // â”€â”€ AI update â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  _updateAI(dt, opponent, arenaLeft, arenaRight) {
    // hit stun
    if (this.state === 'hit') {
      this.stateTimer -= dt;
      this.vx *= 0.9;
      this.x += this.vx * dt;
      this.x = Math.max(arenaLeft, Math.min(arenaRight, this.x));
      if (this.stateTimer <= 0) {
        this.state = 'idle';
        this.attackPhase = null;
        this.attackType = null;
        this.aiTimer = 0.3;
      }
      return;
    }

    // dodge update
    if (this.state === 'dodging') {
      this.dodgeTimer -= dt;
      this.x += this.vx * dt;
      this.x = Math.max(arenaLeft, Math.min(arenaRight, this.x));
      if (this.dodgeTimer <= 0) {
        this.state = 'idle';
        this.vx = 0;
      }
      return;
    }

    // attacking updates (snappy times)
    if (this.state === 'attacking_light' || this.state === 'attacking_heavy') {
      this.attackTimer -= dt;
      this.vx *= 0.9;
      this.x += this.vx * dt;
      this.x = Math.max(arenaLeft, Math.min(arenaRight, this.x));

      if (this.state === 'attacking_light') {
        const age = 0.5 - this.attackTimer;
        if (age < 0.15) {
          this.attackPhase = 'windup';
        } else if (age < 0.30) {
          this.attackPhase = 'active';
        } else {
          this.attackPhase = 'recovery';
        }
        if (this.attackTimer <= 0) {
          this.state = 'idle';
          this.attackPhase = null;
          this.attackType = null;
          this.aiTimer = 0.3 + Math.random() * 0.3;
        }
      } else {
        const age = 0.8 - this.attackTimer;
        if (age < 0.25) {
          this.attackPhase = 'windup';
        } else if (age < 0.45) {
          this.attackPhase = 'active';
        } else {
          this.attackPhase = 'recovery';
        }
        if (this.attackTimer <= 0) {
          this.state = 'idle';
          this.attackPhase = null;
          this.attackType = null;
          this.aiTimer = 0.4 + Math.random() * 0.4;
        }
      }
      return;
    }

    // blocking timer
    if (this.state === 'blocking') {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        this.state = 'idle';
        this.aiTimer = 0.2 + Math.random() * 0.3;
      }
      this.facing = opponent.x > this.x ? 1 : -1;
      return;
    }

    // face opponent
    this.facing = opponent.x > this.x ? 1 : -1;

    // speed multipliers
    const speedMult = this.speedMultiplier || 1.0;

    // reactive defense: if player is attacking and near the AI, it reacts!
    if ((opponent.state === 'attacking_light' || opponent.state === 'attacking_heavy') && 
        opponent.attackPhase === 'windup' && 
        Math.abs(this.x - opponent.x) < 220) {
      
      const reactionRoll = Math.random() * 100;
      if (reactionRoll < 40) { // 40% chance to react instantly!
        if (Math.random() < 0.5) {
          // Dodge backwards!
          this.state = 'dodging';
          this.dodgeTimer = 0.35;
          this.vx = -this.facing * 450 * speedMult;
          this.aiDecision = 'idle';
          return;
        } else {
          // Block!
          this.state = 'blocking';
          this.stateTimer = 0.3 + Math.random() * 0.4;
          return;
        }
      }
    }

    // AI decision timer
    this.aiTimer -= dt;
    if (this.aiTimer <= 0) {
      this.aiTimer = 0.3 + Math.random() * 0.3;
      const dist = Math.abs(this.x - opponent.x);
      const roll = Math.random() * 100;

      if (roll < 8) {
        this.aiDecision = 'idle';
      } else if (roll < 28) {
        this.aiDecision = 'approach';
      } else if (roll < 38) {
        this.aiDecision = 'retreat';
      } else if (roll < 45) {
        this.aiDecision = 'dodge'; // 7% chance to randomly dash/dodge
      } else if (roll < 68) {
        if (dist < 220) {
          this.aiDecision = 'lightAttack';
        } else {
          this.aiDecision = 'approach';
        }
      } else if (roll < 86) {
        if (dist < 220) {
          this.aiDecision = 'heavyAttack';
        } else {
          this.aiDecision = 'approach';
        }
      } else {
        this.aiDecision = 'block';
      }
    }

    // execute decision
    switch (this.aiDecision) {
      case 'idle':
        this.vx *= 0.85;
        if (Math.abs(this.vx) < 5) this.vx = 0;
        this.state = 'idle';
        break;

      case 'approach':
        this.vx = this.facing * 210 * speedMult;
        this.state = 'walking';
        break;

      case 'retreat':
        this.vx = -this.facing * 160 * speedMult;
        this.state = 'walking';
        break;

      case 'dodge':
        this.state = 'dodging';
        this.dodgeTimer = 0.35;
        this.vx = (Math.random() < 0.5 ? -1 : 1) * this.facing * 450 * speedMult;
        this.aiDecision = 'idle';
        break;

      case 'lightAttack': {
        const dist = Math.abs(this.x - opponent.x);
        if (dist < 180) {
          this.state = 'attacking_light';
          this.attackType = 'light';
          this.attackTimer = 0.5;
          this.attackPhase = 'windup';
          this.hitCooldown = 0;
          this.aiDecision = 'idle';
        } else {
          this.vx = this.facing * 140;
          this.state = 'walking';
        }
        break;
      }

      case 'heavyAttack': {
        const dist = Math.abs(this.x - opponent.x);
        if (dist < 180) {
          this.state = 'attacking_heavy';
          this.attackType = 'heavy';
          this.attackTimer = 0.8;
          this.attackPhase = 'windup';
          this.hitCooldown = 0;
          this.aiDecision = 'idle';
        } else {
          this.vx = this.facing * 140;
          this.state = 'walking';
        }
        break;
      }

      case 'block':
        this.state = 'blocking';
        this.stateTimer = 0.4 + Math.random() * 0.4;
        this.aiDecision = 'idle';
        break;

      default:
        this.state = 'idle';
    }

    this.x += this.vx * dt;
    this.x = Math.max(arenaLeft, Math.min(arenaRight, this.x));
  }

  // â”€â”€ render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  render(ctx) {
    // â”€â”€ Motion Trail (Ghosting) â”€â”€
    if (this.history && this.history.length > 1 && (this.state === 'dodging' || this.attackPhase === 'active')) {
      for (let i = 0; i < this.history.length - 1; i += 2) {
        const h = this.history[i];
        ctx.save();
        ctx.translate(h.x, h.y + h.bob);
        ctx.globalAlpha = 0.12 * (i + 1);
        
        if (h.facing === -1) {
          ctx.scale(-1, 1);
        }
        
        if (this.sprite && this.sprite.complete && this.sprite.naturalWidth > 0) {
          ctx.drawImage(this.sprite, -this.width / 2, -this.height, this.width, this.height);
        } else {
          ctx.fillStyle = this.isPlayer ? 'rgba(68,204,102,0.4)' : 'rgba(100,100,136,0.4)';
          ctx.fillRect(-this.width / 2, -this.height, this.width, this.height);
        }
        ctx.restore();
      }
    }

    ctx.save();

    const drawX = this.x;
    const drawY = this.y;
    
    const bob = Math.sin(this.bobTimer * (this.state === 'walking' ? 8 : 3.5)) * 2.5;

    // shadow
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(drawX, drawY + 5, this.width * 0.45 * (this.state === 'dodging' ? 1.25 : 1), 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(drawX, drawY + bob);

    // Procedural tilt (leaning)
    let tilt = 0;
    if (this.state === 'walking') {
      tilt = (this.vx / 300) * 0.08;
    } else if (this.state === 'hit') {
      tilt = -this.facing * 0.25;
    } else if (this.attackPhase === 'windup') {
      tilt = -this.facing * 0.1;
    } else if (this.attackPhase === 'active') {
      tilt = this.facing * 0.18;
    }
    ctx.rotate(tilt);

    // Procedural squash and stretch
    let scaleX = 1;
    let scaleY = 1;
    if (this.state === 'walking') {
      scaleY = 1 + Math.sin(this.bobTimer * 16) * 0.04;
      scaleX = 1 / scaleY;
    } else if (this.state === 'hit') {
      scaleY = 0.85;
      scaleX = 1.15;
    } else if (this.state === 'dodging') {
      scaleX = 1.25;
      scaleY = 0.8;
    } else if (this.state === 'idle') {
      scaleY = 1 + Math.sin(this.bobTimer * 3.5) * 0.02;
      scaleX = 1 / scaleY;
    }
    ctx.scale(scaleX, scaleY);

    if (this.state === 'dodging') {
      ctx.globalAlpha = 0.45;
    }

    let defeated = this.hp <= 0;
    if (defeated) {
      ctx.rotate(Math.PI / 2 * this.facing);
      ctx.globalAlpha = 0.6;
    }

    if (this.facing === -1) {
      ctx.scale(-1, 1);
    }

    if (this.attackPhase === 'windup' && !this.isPlayer) {
      const pulse = Math.sin(this.bobTimer * 18) * 12 + 18;
      ctx.shadowColor = this.attackType === 'heavy' ? '#ff3300' : '#ffaa00';
      ctx.shadowBlur = pulse;
    }

    if (this.name === 'Emperor Xenon') {
      const pulse = Math.sin(this.bobTimer * 14) * 8 + 12;
      ctx.shadowColor = '#ff3300';
      ctx.shadowBlur = pulse;
    }

    // draw sprite
    if (this.sprite && this.sprite.complete && this.sprite.naturalWidth > 0) {
      ctx.drawImage(
        this.sprite,
        -this.width / 2,
        -this.height,
        this.width,
        this.height
      );
    } else {
      ctx.fillStyle = this.isPlayer ? '#44cc66' : '#666688';
      ctx.fillRect(-this.width / 2, -this.height, this.width, this.height);
      ctx.fillStyle = '#fff';
      ctx.font = '12px Rajdhani, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.name, 0, -this.height / 2);
    }

    // flash white on hit
    if (this.flashTimer > 0) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(-this.width / 2, -this.height, this.width, this.height);
      ctx.globalCompositeOperation = 'source-over';
    }

    // Glowing eye overlay
    if (!this.isPlayer && (this.name === 'Mutated Beast' || this.name === 'Emperor Xenon' || this.name === 'Alien Guard')) {
      ctx.save();
      const eyeX = this.name === 'Mutated Beast' ? this.width * 0.15 : this.width * 0.05;
      const eyeY = -this.height * 0.78;
      ctx.fillStyle = this.name === 'Mutated Beast' ? '#ff0000' : (this.name === 'Emperor Xenon' ? '#ff5500' : '#d400ff');
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 10 + Math.sin(this.bobTimer * 10) * 5;
      ctx.beginPath();
      ctx.arc(eyeX, eyeY, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw glowing weapons
    
    // 1. PROTAGONIST SWORD
    if (this.isPlayer) {
      ctx.save();
      ctx.translate(this.width * 0.25, -this.height * 0.45);
      
      let swordAngle = Math.PI / 3.5;
      if (this.state === 'walking') {
        swordAngle += Math.sin(this.bobTimer * 8) * 0.15;
      } else if (this.attackPhase === 'windup') {
        swordAngle = -Math.PI * 0.65;
      } else if (this.attackPhase === 'active') {
        const prog = this.attackTimer / (this.attackType === 'light' ? 0.4 : 0.7);
        swordAngle = lerp(Math.PI / 3, -Math.PI * 0.6, prog);
      } else if (this.state === 'blocking') {
        swordAngle = -Math.PI / 5;
      }
      ctx.rotate(swordAngle);
      
      // Hilt
      ctx.fillStyle = '#222';
      ctx.fillRect(-2, -5, 4, 15);
      ctx.fillStyle = '#666';
      ctx.fillRect(-7, 0, 14, 3.5);
      
      // Blade
      const bladeLen = this.attackType === 'heavy' ? 75 : 55;
      const bladeGrad = ctx.createLinearGradient(0, 0, 0, -bladeLen);
      bladeGrad.addColorStop(0, '#00ffff');
      bladeGrad.addColorStop(0.6, '#88ffff');
      bladeGrad.addColorStop(1, '#ffffff');
      
      ctx.fillStyle = bladeGrad;
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 12 + Math.sin(this.bobTimer * 10) * 4;
      ctx.beginPath();
      ctx.moveTo(-3, 0);
      ctx.lineTo(3, 0);
      ctx.lineTo(1.5, -bladeLen);
      ctx.lineTo(-1.5, -bladeLen);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 2. ALIEN SPEAR
    if (!this.isPlayer && this.name !== 'Mutated Beast') {
      ctx.save();
      ctx.translate(-this.width * 0.15, -this.height * 0.62);
      
      let spearAngle = -Math.PI / 5;
      if (this.state === 'walking') {
        spearAngle += Math.sin(this.bobTimer * 8) * 0.1;
      } else if (this.attackPhase === 'windup') {
        spearAngle = Math.PI * 0.4;
      } else if (this.attackPhase === 'active') {
        spearAngle = -Math.PI * 0.6;
      }
      ctx.rotate(spearAngle);
      
      // Shaft
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(0, 50);
      ctx.lineTo(0, -60);
      ctx.stroke();
      
      // Tip
      const tipColor = this.name === 'Emperor Xenon' ? '#ff3300' : '#cc00ff';
      const tipGrad = ctx.createLinearGradient(0, -60, 0, -90);
      tipGrad.addColorStop(0, tipColor);
      tipGrad.addColorStop(1, '#ffffff');
      
      ctx.fillStyle = tipGrad;
      ctx.shadowColor = tipColor;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(-4, -60);
      ctx.lineTo(4, -60);
      ctx.lineTo(0, -90);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    ctx.shadowBlur = 0;
    ctx.restore();

    // 3. MUTATED BEAST CLAWS
    if (!this.isPlayer && this.name === 'Mutated Beast') {
      ctx.save();
      ctx.translate(drawX, drawY + bob);
      if (this.facing === -1) ctx.scale(-1, 1);
      
      if (this.attackPhase === 'active') {
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
        ctx.lineWidth = 3.5;
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 12;
        
        for (let i = 0; i < 3; i++) {
          const dy = i * 15 - 15;
          ctx.beginPath();
          ctx.arc(this.width * 0.35, -this.height * 0.45 + dy, 30, -Math.PI / 4, Math.PI / 4);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // Blocking Shield
    if (this.state === 'blocking') {
      ctx.save();
      const shieldX = drawX + this.facing * this.width * 0.45;
      ctx.fillStyle = 'rgba(80, 160, 255, 0.18)';
      ctx.strokeStyle = 'rgba(80, 160, 255, 0.75)';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#5599ff';
      ctx.shadowBlur = 15 + Math.sin(this.bobTimer * 15) * 5;
      ctx.beginPath();
      ctx.ellipse(shieldX, drawY - this.height * 0.5, 22, this.height * 0.52, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Attack Swoosh sweep
    if (this.attackPhase === 'active') {
      ctx.save();
      ctx.translate(drawX, drawY + bob);
      if (this.facing === -1) ctx.scale(-1, 1);
      
      const sweepW = this.width * 1.45;
      const sweepH = this.height * 0.55;
      const sweepGrad = ctx.createRadialGradient(this.width * 0.25, -this.height * 0.5, sweepW * 0.4, this.width * 0.25, -this.height * 0.5, sweepW);
      const attackColor = this.isPlayer ? 'rgba(0, 255, 255, ' : (this.name === 'Emperor Xenon' ? 'rgba(255, 68, 0, ' : 'rgba(212, 0, 255, ');
      sweepGrad.addColorStop(0, attackColor + '0)');
      sweepGrad.addColorStop(0.7, attackColor + '0.25)');
      sweepGrad.addColorStop(1, attackColor + '0)');
      ctx.fillStyle = sweepGrad;
      
      ctx.beginPath();
      ctx.ellipse(this.width * 0.25, -this.height * 0.5, sweepW, sweepH, 0, -Math.PI / 3, Math.PI / 3);
      ctx.lineTo(this.width * 0.25, -this.height * 0.5);
      ctx.closePath();
      ctx.fill();
      
      ctx.strokeStyle = this.isPlayer ? '#aaffff' : (this.name === 'Emperor Xenon' ? '#ffaa88' : '#ffaaff');
      ctx.lineWidth = 4.5;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.ellipse(this.width * 0.25, -this.height * 0.5, sweepW * 0.95, sweepH * 0.95, 0, -Math.PI / 3.5, Math.PI / 3.5);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  // â”€â”€ takeDamage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  takeDamage(amount) {
    if (this.state === 'blocking') {
      amount *= 0.2;
    }
    if (this.state === 'dodging') {
      amount = 0;
    }

    amount = Math.round(amount);
    this.hp = Math.max(0, this.hp - amount);

    if (amount > 0) {
      this.state = 'hit';
      this.stateTimer = 0.25;
      this.flashTimer = 0.15;
      this.attackPhase = null;
      this.attackType = null;
      // knockback
      this.vx = -this.facing * 200;
    }

    return amount;
  }

  // â”€â”€ getAttackHitbox â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  getAttackHitbox() {
    if (this.attackPhase !== 'active') return null;

    const range = this.attackType === 'light' ? 60 : 90;
    const hbWidth = range;
    const hbHeight = this.height * 0.6;
    const hbX = this.facing === 1
      ? this.x + this.width / 2
      : this.x - this.width / 2 - range;
    const hbY = this.y - this.height * 0.3 - hbHeight / 2;

    return { x: hbX, y: hbY, width: hbWidth, height: hbHeight };
  }

  // â”€â”€ reset â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  reset() {
    this.hp = this.maxHp;
    this.x = this._startX;
    this.y = this._startY;
    this.facing = this._startFacing;
    this.vx = 0;
    this.vy = 0;
    this.state = 'idle';
    this.stateTimer = 0;
    this.attackPhase = null;
    this.attackType = null;
    this.attackTimer = 0;
    this.hitCooldown = 0;
    this.dodgeTimer = 0;
    this.flashTimer = 0;
    this.aiTimer = 0;
    this.aiDecision = 'idle';
    this.bobTimer = 0;
  }

  // â”€â”€ isAlive â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  isAlive() {
    return this.hp > 0;
  }

  // bounding box for collision
  getBoundingBox() {
    return {
      x: this.x - this.width / 2,
      y: this.y - this.height,
      width: this.width,
      height: this.height,
    };
  }
}

// â”€â”€â”€ CLASS 2: ArenaFighter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class ArenaFighter {
  constructor(canvas, particles, audio) {
    this.canvas = canvas;
    this.particles = particles;
    this.audio = audio;
    this.currentRound = 1;
    this.maxRounds = 3;
    this.roundState = 'waiting';
    this.stateTimer = 0;
    this.player = null;
    this.alien = null;
    this.screenShake = { x: 0, y: 0, intensity: 0, timer: 0 };
    this.floorGlowPhase = 0;
    this._fightTextTimer = 0;
    this._showControls = false;
    this._controlsTimer = 0;

    // Load the arena background image
    this.bgImage = new Image();
    this.bgImage.src = 'assets/arena_bg.png';
    this.bgLoaded = false;
    this.bgImage.onload = () => { this.bgLoaded = true; };

    // Dust / floating debris particles for atmosphere
    this.dustParticles = [];
    for (let i = 0; i < 40; i++) {
      this.dustParticles.push({
        x: Math.random() * 1280,
        y: Math.random() * 720,
        size: 1 + Math.random() * 3,
        alpha: 0.1 + Math.random() * 0.25,
        speed: 5 + Math.random() * 15,
        drift: (Math.random() - 0.5) * 8,
        phase: Math.random() * Math.PI * 2,
      });
    }

    // Ambient heat shimmer waves
    this.heatWaves = [];
    for (let i = 0; i < 6; i++) {
      this.heatWaves.push({
        y: 300 + Math.random() * 200,
        amplitude: 2 + Math.random() * 4,
        frequency: 0.005 + Math.random() * 0.01,
        speed: 1 + Math.random() * 2,
        alpha: 0.02 + Math.random() * 0.03,
      });
    }
  }

  // â”€â”€ start â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  start(images) {
    this.images = images;
    this.player = new Fighter({
      x: 250,
      y: 500,
      name: 'Protagonist',
      isPlayer: true,
      maxHp: 100,
      sprite: images.protagonist,
      width: 80,
      height: 130,
      facing: 1,
    });

    this.currentRound = 1;
    this.roundState = 'intro';
    this.stateTimer = 2.5;
    this._fightTextTimer = 0;

    this.setupLevel(1);

    try { this.audio.playBossFight(); } catch (e) { /* audio not ready */ }
  }

  setupLevel(level) {
    this.currentRound = level; // map currentRound to currentLevel
    
    if (this.player) {
      this.player.reset();
    }

    let name = 'Mutated Beast';
    let sprite = this.images.monster;
    let maxHp = 30;
    let width = 95;
    let height = 135;
    let speedMultiplier = 1.0;
    
    if (level === 2) {
      name = 'Alien Guard';
      sprite = this.images.alien;
      maxHp = 45;
      width = 90;
      height = 140;
      speedMultiplier = 1.0;
    } else if (level === 3) {
      name = 'Emperor Xenon';
      sprite = this.images.alien;
      maxHp = 60;
      width = 100;
      height = 150;
      speedMultiplier = 1.25;
    }

    this.alien = new Fighter({
      x: 950,
      y: 500,
      name: name,
      isPlayer: false,
      maxHp: maxHp,
      sprite: sprite,
      width: width,
      height: height,
      facing: -1,
      speedMultiplier: speedMultiplier
    });
  }

  // â”€â”€ update â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  update(dt, keys) {
    this.floorGlowPhase += dt * 2;

    // screen shake
    if (this.screenShake.timer > 0) {
      this.screenShake.timer -= dt;
      this.screenShake.x = (Math.random() - 0.5) * 2 * this.screenShake.intensity;
      this.screenShake.y = (Math.random() - 0.5) * 2 * this.screenShake.intensity;
      this.screenShake.intensity *= 0.92;
    } else {
      this.screenShake.x = 0;
      this.screenShake.y = 0;
    }

    // drift dust particles
    for (const d of this.dustParticles) {
      d.x += d.drift * dt;
      d.y -= d.speed * dt;
      d.phase += dt;
      if (d.y < -10) { d.y = 730; d.x = Math.random() * 1280; }
      if (d.x < -20) d.x = 1300;
      if (d.x > 1300) d.x = -20;
    }

    // controls overlay remains active
    this._showControls = true;

    switch (this.roundState) {
      case 'intro':
        this.stateTimer -= dt;
        this._fightTextTimer += dt;
        if (this.stateTimer <= 0) {
          this.roundState = 'fighting';
          this._showControls = true;
          this._controlsTimer = 3.0;
        }
        break;

      case 'fighting':
        this.player.update(dt, keys, this.alien, 50, 1230);
        this.alien.update(dt, {}, this.player, 50, 1230);

        // player hits alien
        if (this.player.attackPhase === 'active' && this.player.hitCooldown <= 0) {
          const hitbox = this.player.getAttackHitbox();
          const alienBox = this.alien.getBoundingBox();
          if (hitbox && aabbCollision(hitbox, alienBox)) {
            const damage = this.player.attackType === 'light'
              ? randomInt(8, 12)
              : randomInt(15, 20);
            const dealt = this.alien.takeDamage(damage);
            this.player.hitCooldown = 0.3;

            if (dealt > 0) {
              try {
                this.particles.emitSparks(
                  this.alien.x,
                  this.alien.y - this.alien.height / 2
                );
              } catch (e) {}
              this.screenShake.intensity = dealt > 12 ? 8 : 5;
              this.screenShake.timer = 0.2;
              try { this.audio.playHit(dealt / 20); } catch (e) {}
            }
          }
        }

        // alien hits player
        if (this.alien.attackPhase === 'active' && this.alien.hitCooldown <= 0) {
          const hitbox = this.alien.getAttackHitbox();
          const playerBox = this.player.getBoundingBox();
          if (hitbox && aabbCollision(hitbox, playerBox)) {
            const damage = this.alien.attackType === 'light'
              ? randomInt(5, 7)
              : randomInt(8, 12);
            const dealt = this.player.takeDamage(damage);
            this.alien.hitCooldown = 0.3;

            if (dealt > 0) {
              try {
                this.particles.emitSparks(
                  this.player.x,
                  this.player.y - this.player.height / 2
                );
              } catch (e) {}
              this.screenShake.intensity = 4;
              this.screenShake.timer = 0.15;
              try { this.audio.playHit(dealt / 20); } catch (e) {}
            }
          }
        }

        // check win/lose
        if (this.alien.hp <= 0) {
          this.roundState = 'round_win';
          this.stateTimer = 2.5;
        } else if (this.player.hp <= 0) {
          this.roundState = 'round_lose';
          this.stateTimer = 2.5;
        }
        break;

      case 'round_win':
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          if (this.currentRound < this.maxRounds) {
            this.setupLevel(this.currentRound + 1);
            this.roundState = 'intro';
            this.stateTimer = 2.5;
            this._fightTextTimer = 0;
          } else {
            this.roundState = 'complete';
          }
        }
        break;

      case 'round_lose':
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.setupLevel(this.currentRound);
          this.roundState = 'intro';
          this.stateTimer = 2.5;
          this._fightTextTimer = 0;
        }
        break;
    }

    // Emit subtle ambient dust rising from ground
    if (Math.random() < 0.15) {
      try {
        this.particles.emit({
          x: Math.random() * 1280,
          y: 560 + Math.random() * 30,
          count: 1,
          color: ['#aa7744', '#886633', '#cc9955'],
          speedMin: 10,
          speedMax: 30,
          life: 3.0,
          sizeMin: 1,
          sizeMax: 2.5,
          spread: Math.PI * 0.2,
          gravity: -8,
          type: 'circle'
        });
      } catch (e) {}
    }

    // update particles
    try { this.particles.update(dt); } catch (e) {}
  }

  // ——————————————————————————————————————————————————————————————————————————

  render(ctx) {
    ctx.save();

    // screen shake
    ctx.translate(this.screenShake.x, this.screenShake.y);

    const floorY = 540;

    // ——— Background Image ———
    if (this.bgLoaded) {
      // Draw the background image covering the full canvas
      ctx.drawImage(this.bgImage, 0, 0, 1280, 720);
    } else {
      // Fallback gradient if image not loaded
      const bgGrad = ctx.createLinearGradient(0, 0, 0, 720);
      bgGrad.addColorStop(0, '#1a0a04');
      bgGrad.addColorStop(0.4, '#2d1208');
      bgGrad.addColorStop(0.7, '#4a1a0a');
      bgGrad.addColorStop(1, '#2a0d05');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 1280, 720);
    }

    // ——— Atmospheric Color Overlay (shifts per level) ———
    ctx.save();
    let overlayColor;
    if (this.currentRound === 1) {
      overlayColor = 'rgba(20, 5, 0, 0.15)';
    } else if (this.currentRound === 2) {
      overlayColor = 'rgba(30, 0, 20, 0.2)';
    } else {
      overlayColor = 'rgba(40, 0, 0, 0.25)';
    }
    ctx.fillStyle = overlayColor;
    ctx.fillRect(0, 0, 1280, 720);
    ctx.restore();

    // ——— Heat Shimmer Distortion ———
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    for (const wave of this.heatWaves) {
      const waveX = Math.sin(this.floorGlowPhase * wave.speed) * 40;
      ctx.fillStyle = `rgba(255, 120, 40, ${wave.alpha})`;
      ctx.beginPath();
      ctx.ellipse(640 + waveX, wave.y, 700, wave.amplitude * 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // â”€â”€ Floating Dust / Ash Particles â”€â”€
    ctx.save();
    for (const d of this.dustParticles) {
      const wobble = Math.sin(d.phase * 2) * 3;
      ctx.fillStyle = `rgba(200, 150, 80, ${d.alpha})`;
      ctx.beginPath();
      ctx.arc(d.x + wobble, d.y, d.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // â”€â”€ Fighting Platform (Semi-transparent rock slab) â”€â”€
    const platTopY = floorY;
    const platBotY = 690;
    ctx.save();
    const platGrad = ctx.createLinearGradient(0, platTopY, 0, platBotY);
    platGrad.addColorStop(0, 'rgba(25, 20, 18, 0.85)');
    platGrad.addColorStop(0.3, 'rgba(15, 12, 10, 0.9)');
    platGrad.addColorStop(1, 'rgba(30, 25, 22, 0.8)');
    ctx.fillStyle = platGrad;
    ctx.fillRect(0, platTopY, 1280, platBotY - platTopY);

    // Subtle rock texture lines
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 1.5;
    const seamsX = [180, 360, 520, 700, 860, 1020, 1180];
    for (const sx of seamsX) {
      ctx.beginPath();
      ctx.moveTo(sx, platTopY);
      ctx.lineTo(sx + (sx % 30 - 15), platBotY);
      ctx.stroke();
    }
    ctx.restore();

    // â”€â”€ Platform Edge Glow â”€â”€
    ctx.save();
    const edgePulse = 0.5 + 0.5 * Math.sin(this.floorGlowPhase * 1.5);
    ctx.shadowColor = `rgba(255, 120, 40, ${0.4 + 0.3 * edgePulse})`;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = `rgba(200, 100, 30, ${0.3 + 0.2 * edgePulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, platTopY);
    ctx.lineTo(1280, platTopY);
    ctx.stroke();
    ctx.restore();

    // â”€â”€ Bottom lava glow beneath platform â”€â”€
    ctx.save();
    const bottomGlow = ctx.createLinearGradient(0, platBotY - 5, 0, 720);
    bottomGlow.addColorStop(0, 'rgba(180, 60, 0, 0.4)');
    bottomGlow.addColorStop(0.5, 'rgba(255, 100, 0, 0.15)');
    bottomGlow.addColorStop(1, 'rgba(100, 30, 0, 0.3)');
    ctx.fillStyle = bottomGlow;
    ctx.fillRect(0, platBotY, 1280, 720 - platBotY);
    ctx.restore();

    // ── Vignette (Framing the action, covers AI anomalies at edges) ──
    ctx.save();
    const vigGrad = ctx.createRadialGradient(640, 360, 250, 640, 360, 720);
    vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
    vigGrad.addColorStop(0.65, 'rgba(0,0,0,0.15)');
    vigGrad.addColorStop(1, 'rgba(0,0,0,0.65)');
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, 1280, 720);
    ctx.restore();

    // ── Floor Glow beneath characters (Cyan for Player, theme-color for Aliens) ──
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    
    // Player Glow (Cyan)
    if (this.player && this.player.isAlive()) {
      const pGlow = ctx.createRadialGradient(this.player.x, floorY, 5, this.player.x, floorY, 65);
      pGlow.addColorStop(0, 'rgba(0, 255, 255, 0.28)');
      pGlow.addColorStop(0.5, 'rgba(0, 255, 255, 0.08)');
      pGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = pGlow;
      ctx.beginPath();
      ctx.ellipse(this.player.x, floorY + 2, 65, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Alien Glow
    if (this.alien && this.alien.isAlive()) {
      const isEmperor = this.alien.name === 'Emperor Xenon';
      const isMonster = this.alien.name === 'Mutated Beast';
      const aColor = isEmperor ? 'rgba(255, 85, 0, ' : (isMonster ? 'rgba(255, 0, 0, ' : 'rgba(212, 0, 255, ');
      
      const aGlow = ctx.createRadialGradient(this.alien.x, floorY, 5, this.alien.x, floorY, 70);
      aGlow.addColorStop(0, aColor + '0.30)');
      aGlow.addColorStop(0.5, aColor + '0.10)');
      aGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = aGlow;
      ctx.beginPath();
      ctx.ellipse(this.alien.x, floorY + 2, 70, 14, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // ── reflections (subdued and faded) ──
    if (this.player) {
      this._drawReflection(ctx, this.player, floorY);
    }
    if (this.alien) {
      this._drawReflection(ctx, this.alien, floorY);
    }

    // ── fighters ──
    if (this.player) this.player.render(ctx);
    if (this.alien) this.alien.render(ctx);

    // ── particles ──
    try { this.particles.render(ctx); } catch (e) {}

    // ── round state overlays ──
    this._renderOverlays(ctx);

    // controls
    if (this._showControls) {
      this._renderControls(ctx);
    }

    ctx.restore();
  }
  _drawReflection(ctx, fighter, floorY) {
    ctx.save();
    
    // Setup reflection coordinates
    ctx.translate(fighter.x, fighter.y);
    ctx.scale(fighter.facing === -1 ? -1 : 1, -1);
    ctx.globalAlpha = 0.15;
    ctx.globalCompositeOperation = 'screen';

    // Draw flipped sprite
    if (fighter.sprite && fighter.sprite.complete && fighter.sprite.naturalWidth > 0) {
      ctx.drawImage(
        fighter.sprite,
        -fighter.width / 2,
        0,
        fighter.width,
        fighter.height
      );
    } else {
      ctx.fillStyle = fighter.isPlayer ? 'rgba(68,204,102,0.3)' : 'rgba(100,100,136,0.3)';
      ctx.fillRect(-fighter.width / 2, 0, fighter.width, fighter.height);
    }

    // Apply destination-out to fade out reflection as it goes down
    const fadeGrad = ctx.createLinearGradient(0, 0, 0, fighter.height);
    fadeGrad.addColorStop(0, 'rgba(0,0,0,0)');
    fadeGrad.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = fadeGrad;
    ctx.fillRect(-fighter.width, 0, fighter.width * 2, fighter.height);

    ctx.restore();
  }

  _renderOverlays(ctx) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    switch (this.roundState) {
      case 'intro': {
        // round text
        ctx.font = 'bold 64px Orbitron, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 20;
        ctx.fillText(`LEVEL ${this.currentRound}`, 640, 260);

        // FIGHT! text after 1.5s
        if (this._fightTextTimer > 1.5) {
          const fightAlpha = Math.min(1, (this._fightTextTimer - 1.5) * 3);
          const fightScale = 1 + Math.sin((this._fightTextTimer - 1.5) * 8) * 0.05;
          ctx.save();
          ctx.translate(640, 340);
          ctx.scale(fightScale, fightScale);
          ctx.font = 'bold 80px Orbitron, sans-serif';
          ctx.fillStyle = `rgba(255, 80, 50, ${fightAlpha})`;
          ctx.shadowColor = `rgba(255, 50, 20, ${fightAlpha})`;
          ctx.shadowBlur = 30;
          ctx.fillText('FIGHT!', 0, 0);
          ctx.restore();
        }
        break;
      }

      case 'round_win':
        ctx.font = 'bold 56px Orbitron, sans-serif';
        ctx.fillStyle = '#44ff88';
        ctx.shadowColor = '#00ff66';
        ctx.shadowBlur = 25;
        ctx.fillText('LEVEL COMPLETED!', 640, 280);

        if (this.currentRound < this.maxRounds) {
          ctx.font = '24px Rajdhani, sans-serif';
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#aaddcc';
          ctx.fillText('Preparing next level...', 640, 340);
        } else {
          ctx.font = '28px Rajdhani, sans-serif';
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#ffdd44';
          ctx.fillText('VICTORY! The antidote is yours!', 640, 340);
        }
        break;

      case 'round_lose':
        ctx.font = 'bold 56px Orbitron, sans-serif';
        ctx.fillStyle = '#ff4444';
        ctx.shadowColor = '#ff2222';
        ctx.shadowBlur = 25;
        ctx.fillText('TRY AGAIN...', 640, 280);

        ctx.font = '24px Rajdhani, sans-serif';
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#cc8888';
        ctx.fillText('The fight continues...', 640, 340);
        break;
    }

    ctx.restore();
  }

  _renderControls(ctx) {
    const alpha = 1.0;
    ctx.save();
    ctx.globalAlpha = alpha * 0.85;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.roundRect(440, 600, 400, 100, 12);
    ctx.fill();

    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#aaddff';
    ctx.font = '14px Rajdhani, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('A/D or â†/â†’ â€” Move  |  J or Z â€” Light Attack', 640, 628);
    ctx.fillText('K or X â€” Heavy Attack  |  L or C â€” Block', 640, 650);
    ctx.fillText('SHIFT â€” Dodge  |  Defeat the alien!', 640, 672);
    ctx.restore();
  }

  // â”€â”€ queries â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  isComplete() {
    return this.roundState === 'complete';
  }

  getCurrentRound() {
    return this.currentRound;
  }
}

// â”€â”€â”€ CLASS 3: Game (Main Controller) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class Game {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.state = 'loading';
    this.particles = new window.ParticleSystem();
    this.audio = new window.AudioManager();
    this.transition = null;
    this.arena = null;
    this.keys = {};
    this.prevKeys = {};
    this.images = {};
    this.lastTime = 0;
    this.titleStars = [];
    this.titlePulse = 0;
    this.loadProgress = 0;
    this._victoryStarted = false;
    this._victoryParticleTimer = 0;
    this._victoryGlow = 0;
    this.screenShake = { x: 0, y: 0, intensity: 0, timer: 0 };
  }

  // â”€â”€ init â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  init() {
    this.canvas = document.getElementById('gameCanvas');
    this.canvas.width = 1280;
    this.canvas.height = 720;
    this.ctx = this.canvas.getContext('2d');

    this.resizeCanvas();
    this.setupInput();

    // title stars
    for (let i = 0; i < 150; i++) {
      this.titleStars.push({
        x: Math.random() * 1280,
        y: Math.random() * 720,
        size: Math.random() * 2 + 0.5,
        speed: 0.1 + Math.random() * 0.4,
        brightness: Math.random(),
      });
    }

    // load images then show title
    this.loadImages().then(() => {
      this.state = 'title';
      const loadingScreen = document.getElementById('loading-screen');
      if (loadingScreen) loadingScreen.style.display = 'none';
      const titleScreen = document.getElementById('title-screen');
      if (titleScreen) titleScreen.style.display = 'none'; // Keep HTML title screen hidden, rendering on canvas instead
    });

    // start game loop
    this.lastTime = performance.now();
    requestAnimationFrame(this.gameLoop.bind(this));
  }

  // â”€â”€ loadImages â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  loadImages() {
    const names = ['protagonist', 'alien', 'monster', 'spaceship', 'antidote'];
    const fallbackColors = {
      protagonist: '#44cc66',
      alien: '#556677',
      monster: '#cc3333',
      spaceship: '#3366cc',
      antidote: '#00cccc',
    };

    return new Promise((resolve) => {
      let loaded = 0;
      const total = names.length;

      const checkDone = () => {
        loaded++;
        this.loadProgress = loaded / total;
        if (loaded >= total) resolve();
      };

      const createFallback = (name, color) => {
        const c = document.createElement('canvas');
        c.width = 128;
        c.height = 192;
        const cx = c.getContext('2d');

        // stylish fallback with gradient
        const grad = cx.createLinearGradient(0, 0, 128, 192);
        grad.addColorStop(0, color);
        grad.addColorStop(1, '#111');
        cx.fillStyle = grad;
        cx.beginPath();
        cx.roundRect(4, 4, 120, 184, 12);
        cx.fill();

        cx.strokeStyle = 'rgba(255,255,255,0.3)';
        cx.lineWidth = 2;
        cx.beginPath();
        cx.roundRect(4, 4, 120, 184, 12);
        cx.stroke();

        cx.fillStyle = '#fff';
        cx.font = 'bold 14px Orbitron, sans-serif';
        cx.textAlign = 'center';
        cx.fillText(name.toUpperCase(), 64, 100);

        const img = new Image();
        img.src = c.toDataURL();
        return img;
      };

      for (const name of names) {
        const img = new Image();
        img.onload = () => {
          this.images[name] = removeWhiteBackground(img);
          checkDone();
        };
        img.onerror = () => {
          this.images[name] = createFallback(name, fallbackColors[name]);
          checkDone();
        };
        img.src = 'assets/' + name + '.png?v=' + Date.now();
      }

      // timeout fallback
      setTimeout(() => {
        for (const name of names) {
          if (!this.images[name]) {
            this.images[name] = createFallback(name, fallbackColors[name]);
          }
        }
        if (loaded < total) {
          loaded = total;
          this.loadProgress = 1;
          resolve();
        }
      }, 5000);
    });
  }

  // â”€â”€ gameLoop â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  gameLoop(timestamp) {
    let dt = (timestamp - this.lastTime) / 1000;
    if (dt > 1 / 30) dt = 1 / 30;
    if (dt < 0) dt = 0;
    this.lastTime = timestamp;

    this.update(dt);
    this.render(this.ctx);

    // copy keys to prevKeys
    this.prevKeys = {};
    for (const k in this.keys) {
      this.prevKeys[k] = this.keys[k];
    }

    requestAnimationFrame(this.gameLoop.bind(this));
  }

  // â”€â”€ update â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  update(dt) {
    if (this.screenShake.timer > 0) {
      this.screenShake.timer -= dt;
      this.screenShake.x = (Math.random() - 0.5) * 2 * this.screenShake.intensity;
      this.screenShake.y = (Math.random() - 0.5) * 2 * this.screenShake.intensity;
      this.screenShake.intensity *= 0.92;
    } else {
      this.screenShake.x = 0;
      this.screenShake.y = 0;
    }

    switch (this.state) {
      case 'loading':
        // animate loading
        break;

      case 'title':
        this.titlePulse += dt;
        // drift stars
        for (const s of this.titleStars) {
          s.y += s.speed;
          if (s.y > 720) {
            s.y = 0;
            s.x = Math.random() * 1280;
          }
        }

        // start on Enter or click (handled in input)
        if (this.keys['Enter'] || this.keys['Space'] || this.keys['click']) {
          this.keys['Enter'] = false;
          this.keys['Space'] = false;
          this.keys['click'] = false;
          this._startFromTitle();
        }
        break;

      case 'video':
        // video plays itself; we listen for events
        break;



      case 'transition':
        this.transition.update(dt);
        if (this.transition.isComplete()) {
          this.arena = new ArenaFighter(this.canvas, this.particles, this.audio);
          this.arena.start(this.images);
          const hud = document.getElementById('hud');
          if (hud) hud.style.display = 'flex';
          this.state = 'fight';
        }
        break;

      case 'fight': {
        const playerKeys = {
          left: this.keys['ArrowLeft'] || this.keys['KeyA'],
          right: this.keys['ArrowRight'] || this.keys['KeyD'],
          up: this.keys['ArrowUp'] || this.keys['KeyW'],
          down: this.keys['ArrowDown'] || this.keys['KeyS'],
          lightAttack: (this.keys['KeyJ'] || this.keys['KeyZ']) && !(this.prevKeys['KeyJ'] || this.prevKeys['KeyZ']),
          heavyAttack: (this.keys['KeyK'] || this.keys['KeyX']) && !(this.prevKeys['KeyK'] || this.prevKeys['KeyX']),
          block: this.keys['KeyL'] || this.keys['KeyC'],
          dodge: (this.keys['ShiftLeft'] || this.keys['ShiftRight']) && !(this.prevKeys['ShiftLeft'] || this.prevKeys['ShiftRight']),
        };

        this.arena.update(dt, playerKeys);

        // update HUD
        if (this.arena.player) {
          const phpEl = document.getElementById('player-hp');
          if (phpEl) {
            const pct = Math.max(0, (this.arena.player.hp / this.arena.player.maxHp) * 100);
            phpEl.style.width = pct + '%';
            // color shift on low hp
            if (pct < 30) phpEl.style.background = 'linear-gradient(90deg, #ff3333, #ff6644)';
            else if (pct < 60) phpEl.style.background = 'linear-gradient(90deg, #ffaa33, #ffcc44)';
            else phpEl.style.background = 'linear-gradient(90deg, #33ff88, #44ffaa)';
          }
        }
        if (this.arena.alien) {
          const ahpEl = document.getElementById('alien-hp');
          if (ahpEl) {
            const pct = Math.max(0, (this.arena.alien.hp / this.arena.alien.maxHp) * 100);
            ahpEl.style.width = pct + '%';
            if (pct < 30) ahpEl.style.background = 'linear-gradient(90deg, #ff3333, #ff6644)';
            else ahpEl.style.background = 'linear-gradient(90deg, #ff4466, #ff6688)';
          }
        }

        const rcEl = document.getElementById('round-counter');
        if (rcEl) rcEl.textContent = 'LEVEL ' + this.arena.getCurrentRound();

        // Update enemy name in HUD
        if (this.arena.alien) {
          const anEl = document.getElementById('alien-name');
          if (anEl) anEl.textContent = this.arena.alien.name.toUpperCase();
        }

        // round banner
        const banner = document.getElementById('round-banner');
        if (banner) {
          const rt = banner.querySelector('.round-text');
          if (this.arena.roundState === 'intro') {
            banner.style.display = 'block';
            if (rt) rt.textContent = 'LEVEL ' + this.arena.getCurrentRound();
          } else if (this.arena.roundState === 'round_win') {
            banner.style.display = 'block';
            if (rt) rt.textContent = 'LEVEL COMPLETED!';
          } else if (this.arena.roundState === 'round_lose') {
            banner.style.display = 'block';
            if (rt) rt.textContent = 'TRY AGAIN...';
          } else {
            banner.style.display = 'none';
          }
        }

        if (this.arena.isComplete()) {
          this.state = 'victory';
        }
        break;
      }

      case 'victory':
        if (!this._victoryStarted) {
          this._victoryStarted = true;
          this._victoryPhase = 'waiting';
          this._brokenTime = 0;
          this._victoryPlayer = new Fighter({
            x: 540,
            y: 540,
            name: 'Protagonist',
            isPlayer: true,
            maxHp: 100,
            sprite: this.images.protagonist,
            width: 80,
            height: 130,
            facing: 1,
          });

          const hud = document.getElementById('hud');
          if (hud) hud.style.display = 'none';
          const banner = document.getElementById('round-banner');
          if (banner) banner.style.display = 'none';

          const victoryScreen = document.getElementById('victory-screen');
          if (victoryScreen) {
            victoryScreen.style.display = 'flex';
            victoryScreen.style.opacity = '0';
            requestAnimationFrame(() => {
              victoryScreen.style.transition = 'opacity 1.5s ease-in';
              victoryScreen.style.opacity = '1';
            });
          }

          // Initial DOM text setup
          const vText = document.getElementById('victory-text');
          const vSub = document.getElementById('victory-sub');
          const vPrompt = document.getElementById('victory-prompt');
          if (vText) {
            vText.textContent = 'THE FINAL TASK';
            vText.classList.remove('saved');
          }
          if (vSub) vSub.textContent = 'The antidote is in your hands. But it must be broken to halt the chain reaction!';
          if (vPrompt) vPrompt.textContent = 'PRESS A TO BREAK THE ANTIDOTE VIAL';

          try { this.audio.stopAll(); } catch (e) {}
          try { this.audio.playVictory(); } catch (e) {}
        }

        this._victoryGlow += dt;
        this._victoryParticleTimer += dt;

        // update the victory player animations
        if (this._victoryPlayer) {
          this._victoryPlayer.update(dt, {}, { x: 9999, y: 540 }, 0, 1280);
        }

        // celebration particles (only if broken)
        if (this._victoryPhase === 'broken' && this._victoryParticleTimer > 0.15) {
          this._victoryParticleTimer = 0;
          try {
            this.particles.emitSparks(
              300 + Math.random() * 680,
              100 + Math.random() * 400
            );
          } catch (e) {}
        }

        try { this.particles.update(dt); } catch (e) {}

        // drift title stars
        for (const s of this.titleStars) {
          s.y += s.speed * 0.5;
          if (s.y > 720) { s.y = 0; s.x = Math.random() * 1280; }
        }

        // Victory sub-state machine checks
        if (this._victoryPhase === 'waiting') {
          if (this.keys['KeyA'] && !this.prevKeys['KeyA']) {
            this._victoryPhase = 'slashing';
            if (this._victoryPlayer) {
              this._victoryPlayer.state = 'attacking_heavy';
              this._victoryPlayer.attackType = 'heavy';
              this._victoryPlayer.attackTimer = 0.7;
              this._victoryPlayer.attackPhase = 'windup';
              this._victoryPlayer.hitCooldown = 0;
            }
            const vPrompt = document.getElementById('victory-prompt');
            if (vPrompt) vPrompt.textContent = '';
            
            try { this.audio.playWhoosh(); } catch(e) {}
          }
        } else if (this._victoryPhase === 'slashing') {
          // Check if attack is active (reaches the vial)
          if (this._victoryPlayer && this._victoryPlayer.attackPhase === 'active') {
            this._victoryPhase = 'broken';
            this._brokenTime = this._victoryGlow;

            // Screen shake
            this.screenShake.intensity = 22;
            this.screenShake.timer = 0.65;

            // Play break sound effects
            try {
              this.audio.playThunder();
              this.audio.playHit(1.2);
            } catch (e) {}

            // Emit fluid splash (toxic/chemical antidote green/cyan sparks)
            try {
              this.particles.emit({
                x: 690,
                y: 510,
                count: 60,
                color: ['#00ffaa', '#00ffcc', '#33ff88', '#ffffff'],
                speedMin: 150,
                speedMax: 400,
                life: 2.5,
                sizeMin: 3,
                sizeMax: 7,
                spread: Math.PI * 2,
                gravity: 220,
                type: 'circle'
              });
            } catch (e) {}

            // Emit glass shards (white/light blue square particles falling)
            try {
              this.particles.emit({
                x: 690,
                y: 510,
                count: 25,
                color: ['#ffffff', '#e0ffff', '#aaffff'],
                speedMin: 80,
                speedMax: 220,
                life: 1.5,
                sizeMin: 2,
                sizeMax: 5,
                spread: Math.PI * 2,
                gravity: 320,
                type: 'square'
              });
            } catch (e) {}

            // Update DOM text
            const vText = document.getElementById('victory-text');
            const vSub = document.getElementById('victory-sub');
            const vPrompt = document.getElementById('victory-prompt');

            if (vText) {
              vText.textContent = 'YOU SAVED THE VILLAGE';
              vText.classList.add('saved');
            }
            if (vSub) {
              vSub.textContent = 'from the chain reaction!';
            }
            if (vPrompt) {
              vPrompt.textContent = 'PRESS ENTER TO RESTART';
            }
          }
        } else if (this._victoryPhase === 'broken') {
          // Restart logic on Enter, Space, or click (only allowed once broken!)
          if (this.keys['Enter'] || this.keys['Space'] || this.keys['click']) {
            this.keys['Enter'] = false;
            this.keys['Space'] = false;
            this.keys['click'] = false;

            const victoryScreen = document.getElementById('victory-screen');
            if (victoryScreen) {
              victoryScreen.style.display = 'none';
              const vText = document.getElementById('victory-text');
              if (vText) vText.classList.remove('saved');
            }

            this._victoryStarted = false;
            this._victoryGlow = 0;
            this._victoryParticleTimer = 0;
            this.state = 'title';
            try { this.audio.stopAll(); } catch (e) {}
          }
        }
        break;
    }
  }

  // â”€â”€ _startFromTitle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  _startFromTitle() {
    if (this.state !== 'title') return;
    this.state = 'starting';
    try { this.audio.init(); } catch (e) {}

    const titleScreen = document.getElementById('title-screen');
    if (titleScreen) titleScreen.style.display = 'none';

    const video = document.getElementById('introVideo');
    if (video) {
      this._tryVideo(video);
    } else {
      this._skipIntroVideo();
    }
  }

  _tryVideo(video) {
    const onVideoReady = () => {
      this.canvas.style.display = 'none';
      video.style.display = 'block';
      this.state = 'video';

      const endHandler = () => {
        video.pause();
        video.style.display = 'none';
        this._skipIntroVideo();
        video.removeEventListener('ended', endHandler);
        video.removeEventListener('error', errHandler);
      };
      const errHandler = () => {
        video.style.display = 'none';
        this._skipIntroVideo();
        video.removeEventListener('ended', endHandler);
        video.removeEventListener('error', errHandler);
      };

      video.addEventListener('ended', endHandler);
      video.addEventListener('error', errHandler);

      // escape to skip
      const escHandler = (e) => {
        if (e.code === 'Escape') {
          video.pause();
          video.style.display = 'none';
          this._skipIntroVideo();
          document.removeEventListener('keydown', escHandler);
          video.removeEventListener('ended', endHandler);
          video.removeEventListener('error', errHandler);
        }
      };
      document.addEventListener('keydown', escHandler);

      video.play().catch((err) => {
        console.warn("Autoplay failed:", err);
        video.style.display = 'none';
        this._skipIntroVideo();
      });
    };

    // check if video is loadable
    video.addEventListener('loadedmetadata', onVideoReady, { once: true });
    video.addEventListener('error', () => {
      this._skipIntroVideo();
    }, { once: true });

    try {
      video.load();
    } catch (e) {
      this._skipIntroVideo();
    }

    // fallback timeout in case load hangs
    setTimeout(() => {
      if (this.state === 'starting') {
        this._skipIntroVideo();
      }
    }, 4000);
  }

  _skipIntroVideo() {
    this.canvas.style.display = 'block';
    this.transition = new window.StarfieldTransition(this.canvas);
    this.transition.start(this.images.spaceship);
    this.state = 'transition';
  }

  // â”€â”€ render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  render(ctx) {
    ctx.clearRect(0, 0, 1280, 720);

    switch (this.state) {
      case 'loading':
        this._renderLoading(ctx);
        break;

      case 'title':
        this._renderTitle(ctx);
        break;

      case 'transition':
        if (this.transition) this.transition.render(ctx);
        break;

      case 'fight':
        if (this.arena) this.arena.render(ctx);
        break;

      case 'victory':
        this._renderVictory(ctx);
        break;
    }

    // Draw subtle premium CRT scanline overlay over Title screen and Combat for a hand-crafted arcade feel
    if (this.state === 'title' || this.state === 'fight' || this.state === 'victory') {
      this._drawCRTOverlay(ctx);
    }
  }

  _drawCRTOverlay(ctx) {
    ctx.save();
    
    // Draw subtle horizontal scanlines
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
    ctx.lineWidth = 1;
    for (let y = 0; y < 720; y += 3) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1280, y);
      ctx.stroke();
    }
    
    // Subtle CRT vignette highlight
    const crtGrad = ctx.createRadialGradient(640, 360, 480, 640, 360, 750);
    crtGrad.addColorStop(0, 'rgba(0, 255, 255, 0.005)'); // slight cyan color grade center
    crtGrad.addColorStop(1, 'rgba(0, 0, 0, 0.28)');     // dark corner vignette
    ctx.fillStyle = crtGrad;
    ctx.fillRect(0, 0, 1280, 720);
    
    ctx.restore();
  }

  _renderLoading(ctx) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 1280, 720);

    // loading bar
    const barW = 400;
    const barH = 8;
    const barX = (1280 - barW) / 2;
    const barY = 400;

    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 4);
    ctx.fill();

    ctx.fillStyle = '#00ffff';
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW * this.loadProgress, barH, 4);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#aaddff';
    ctx.font = '16px Rajdhani, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LOADING...', 640, barY - 20);
  }

  _renderTitle(ctx) {
    // dark background
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 1280, 720);

    // stars
    for (const s of this.titleStars) {
      const alpha = 0.3 + 0.7 * Math.abs(Math.sin(this.titlePulse * 2 + s.brightness * 6));
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // subtle center glow
    const radGrad = ctx.createRadialGradient(640, 360, 50, 640, 360, 400);
    radGrad.addColorStop(0, 'rgba(0,120,180,0.08)');
    radGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = radGrad;
    ctx.fillRect(0, 0, 1280, 720);

    // ── Scrolling 3D Neon Grid (Synthwave style) ──
    const horizon = 485;
    ctx.save();
    
    // Grid glow gradient under horizon
    const gridBgGrad = ctx.createLinearGradient(0, horizon, 0, 720);
    gridBgGrad.addColorStop(0, 'rgba(136, 68, 255, 0.05)');
    gridBgGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gridBgGrad;
    ctx.fillRect(0, horizon, 1280, 720 - horizon);

    // Perspective lines radiating outwards
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    const numVanishingLines = 28;
    for (let i = 0; i <= numVanishingLines; i++) {
      const pct = i / numVanishingLines;
      const startX = 250 + pct * 780; // Intersect at horizon
      const endX = -400 + pct * 2080;  // Expand wide at bottom
      ctx.beginPath();
      ctx.moveTo(startX, horizon);
      ctx.lineTo(endX, 720);
      ctx.stroke();
    }

    // Horizontal perspective lines scrolling towards screen
    const speed = 70;
    const gridOffset = (this.titlePulse * speed) % 60;
    const numHorizontalLines = 14;
    for (let i = 0; i < numHorizontalLines; i++) {
      const progress = (i + gridOffset / 60) / numHorizontalLines;
      const ratio = Math.pow(progress, 2.5); // Exponential perspective spacing
      const lineY = horizon + (720 - horizon) * ratio;

      ctx.strokeStyle = `rgba(0, 255, 255, ${0.05 + ratio * 0.22})`;
      ctx.lineWidth = 0.5 + ratio * 2.2;
      ctx.beginPath();
      ctx.moveTo(0, lineY);
      ctx.lineTo(1280, lineY);
      ctx.stroke();
    }

    // Neon divider line at the horizon
    ctx.strokeStyle = '#ff33aa';
    ctx.shadowColor = '#ff33aa';
    ctx.shadowBlur = 12;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    ctx.lineTo(1280, horizon);
    ctx.stroke();
    
    ctx.restore();

    // Render Title Screen text directly on Canvas for guaranteed visibility
    ctx.save();
    
    // Main Game Title: THE RUSTING TIDES
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 72px Orbitron, sans-serif';
    ctx.fillStyle = '#00ffff';
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 25;
    ctx.fillText('THE RUSTING TIDES', 640, 220);

    // Subtitle: FIGHT FOR THE ANTIDOTE
    ctx.font = 'bold 24px Orbitron, sans-serif';
    ctx.fillStyle = '#ff4444';
    ctx.shadowColor = '#ff4444';
    ctx.shadowBlur = 12;
    ctx.fillText('FIGHT FOR THE ANTIDOTE', 640, 300);

    // Pulse prompt text opacity
    const promptAlpha = 0.4 + 0.6 * Math.abs(Math.sin(this.titlePulse * 3.5));
    ctx.font = 'bold 20px Orbitron, sans-serif';
    ctx.fillStyle = `rgba(255, 215, 0, ${promptAlpha})`;
    ctx.shadowColor = `rgba(255, 215, 0, ${promptAlpha})`;
    ctx.shadowBlur = 8;
    ctx.fillText('PRESS ENTER OR CLICK TO START', 640, 440);

    // Controls Guide box
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(240, 520, 800, 110, 12);
    ctx.fill();
    ctx.stroke();

    // Controls Guide text
    ctx.fillStyle = '#aaddff';
    ctx.font = '600 16px Rajdhani, sans-serif';
    ctx.fillText('CONTROLS', 640, 545);
    
    ctx.fillStyle = '#888899';
    ctx.font = '500 14px Rajdhani, sans-serif';
    ctx.fillText('WASD / Arrows â€” Move  |  J or Z â€” Light Attack  |  K or X â€” Heavy Attack', 640, 575);
    ctx.fillText('L or C â€” Block  |  SPACE â€” Dodge  |  ESC â€” Skip Video', 640, 600);
    ctx.restore();
  }

  _renderVictory(ctx) {
    // dark starfield background
    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, 1280, 720);

    // stars
    for (const s of this.titleStars) {
      const alpha = 0.3 + 0.7 * Math.abs(Math.sin(this._victoryGlow * 1.5 + s.brightness * 6));
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }

    const floorY = 540;

    // Draw sci-fi basalt pedestal
    ctx.save();
    
    // Pedestal gradient
    const platGrad = ctx.createLinearGradient(0, floorY, 0, 720);
    platGrad.addColorStop(0, '#121216');
    platGrad.addColorStop(0.3, '#0c0c0e');
    platGrad.addColorStop(1, '#1c1c24');
    ctx.fillStyle = platGrad;
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    
    // Draw top ellipse slab
    ctx.beginPath();
    ctx.ellipse(640, floorY, 340, 28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // Draw 3D side structure
    ctx.fillRect(300, floorY, 680, 180);
    ctx.beginPath();
    ctx.moveTo(300, floorY);
    ctx.lineTo(300, 720);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(980, floorY);
    ctx.lineTo(980, 720);
    ctx.stroke();
    
    // Pulsing cyber grid / circuitry lines on pedestal for a highly polished feel
    const pulseIntensity = 0.4 + 0.3 * Math.sin(this._victoryGlow * 2);
    const glowColor = this._victoryPhase === 'broken' ? `rgba(68, 255, 68, ${0.4 + 0.5 * pulseIntensity})` : `rgba(0, 255, 255, ${0.2 + 0.3 * pulseIntensity})`;
    ctx.strokeStyle = glowColor;
    ctx.shadowBlur = this._victoryPhase === 'broken' ? 8 : 4;
    ctx.shadowColor = this._victoryPhase === 'broken' ? '#44ff44' : '#00ffff';
    ctx.lineWidth = 1.5;
    
    // Pedestal circuitry lines
    const circuitLines = [
      [380, floorY, 380, 720],
      [480, floorY, 480, 720],
      [580, floorY, 580, 720],
      [700, floorY, 700, 720],
      [800, floorY, 800, 720],
      [900, floorY, 900, 720]
    ];
    for (const line of circuitLines) {
      ctx.beginPath();
      ctx.moveTo(line[0], line[1]);
      ctx.lineTo(line[2], line[3]);
      ctx.stroke();
    }
    
    // Glowing horizontal borders
    ctx.beginPath();
    ctx.moveTo(300, floorY + 40);
    ctx.lineTo(980, floorY + 40);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(300, floorY + 120);
    ctx.lineTo(980, floorY + 120);
    ctx.stroke();
    
    ctx.shadowBlur = 0;
    ctx.restore();

    // 1. Draw protagonist reflection
    if (this._victoryPlayer) {
      ctx.save();
      ctx.translate(this._victoryPlayer.x, floorY);
      ctx.scale(1, -0.2); // flat perspective reflection
      ctx.globalAlpha = 0.12;
      ctx.globalCompositeOperation = 'screen';
      if (this._victoryPlayer.sprite && this._victoryPlayer.sprite.complete && this._victoryPlayer.sprite.naturalWidth > 0) {
        ctx.drawImage(this._victoryPlayer.sprite, -this._victoryPlayer.width / 2, -this._victoryPlayer.height, this._victoryPlayer.width, this._victoryPlayer.height);
      } else {
        ctx.fillStyle = '#44cc66';
        ctx.fillRect(-this._victoryPlayer.width / 2, -this._victoryPlayer.height, this._victoryPlayer.width, this._victoryPlayer.height);
      }
      ctx.restore();
    }
    
    // 2. Draw antidote vial reflection (if not broken)
    if (this._victoryPhase !== 'broken') {
      const img = this.images.antidote;
      if (img) {
        ctx.save();
        ctx.translate(690, floorY);
        ctx.scale(1, -0.2);
        ctx.globalAlpha = 0.12;
        ctx.globalCompositeOperation = 'screen';
        const pulse = 1 + Math.sin(this._victoryGlow * 3) * 0.05;
        const imgW = 70 * pulse;
        const imgH = 105 * pulse;
        ctx.drawImage(img, -imgW / 2, -imgH, imgW, imgH);
        ctx.restore();
      }
    }

    // Render protagonist
    if (this._victoryPlayer) {
      this._victoryPlayer.render(ctx);
    }

    // Draw antidote vial (if not broken)
    if (this._victoryPhase !== 'broken') {
      const img = this.images.antidote;
      if (img) {
        const pulse = 1 + Math.sin(this._victoryGlow * 3) * 0.05;
        const imgW = 70 * pulse;
        const imgH = 105 * pulse;

        // vial glow
        ctx.save();
        ctx.shadowColor = '#00ffcc';
        ctx.shadowBlur = 20 + Math.sin(this._victoryGlow * 4) * 10;
        ctx.beginPath();
        ctx.arc(690, floorY - imgH / 2, 30 * pulse, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 255, 200, 0.12)';
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.drawImage(img, 690 - imgW / 2, floorY - imgH, imgW, imgH);
        ctx.restore();
      }
    }

    // Draw green puddle and glass shards (if broken)
    if (this._victoryPhase === 'broken') {
      // Spreading green puddle in perspective
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const age = this._victoryGlow - this._brokenTime;
      const puddleRadiusX = Math.min(220, age * 160);
      const puddleRadiusY = puddleRadiusX * 0.12;
      
      const puddleGrad = ctx.createRadialGradient(690, floorY, 0, 690, floorY, puddleRadiusX);
      puddleGrad.addColorStop(0, 'rgba(0, 255, 170, 0.85)');
      puddleGrad.addColorStop(0.3, 'rgba(0, 255, 170, 0.5)');
      puddleGrad.addColorStop(0.7, 'rgba(0, 255, 80, 0.2)');
      puddleGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = puddleGrad;
      
      ctx.beginPath();
      ctx.ellipse(690, floorY, puddleRadiusX, puddleRadiusY, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      
      // Draw shattered glass shards scattered around
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.strokeStyle = 'rgba(180, 240, 255, 0.9)';
      ctx.lineWidth = 1;
      ctx.shadowColor = '#88e8ff';
      ctx.shadowBlur = 3;
      
      // Static offsets for glass shards
      const shardOffsets = [
        [-20, 2], [15, -4], [-35, -2], [40, 1], [-50, -1], [25, 3],
        [-10, -5], [5, 4], [30, -3], [-45, 3]
      ];
      for (const offset of shardOffsets) {
        const shardX = 690 + offset[0];
        const shardY = floorY + offset[1];
        
        ctx.beginPath();
        ctx.moveTo(shardX, shardY - 3);
        ctx.lineTo(shardX + 4, shardY + 2);
        ctx.lineTo(shardX - 3, shardY + 3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }

    // Render active particles
    try {
      this.particles.render(ctx);
    } catch (e) {}
  }

  // â”€â”€ setupInput â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  setupInput() {
    const gameKeys = new Set([
      'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
      'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyJ', 'KeyK', 'KeyL',
      'KeyZ', 'KeyX', 'KeyC', 'ShiftLeft', 'ShiftRight',
    ]);

    document.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (gameKeys.has(e.code)) e.preventDefault();
    });

    document.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    // click / touch for menus
    this.canvas.addEventListener('click', () => {
      this.keys['click'] = true;
    });

    this.canvas.addEventListener('touchstart', (e) => {
      this.keys['click'] = true;
      e.preventDefault();
    }, { passive: false });

    // title screen start button
    const titleScreen = document.getElementById('title-screen');
    if (titleScreen) {
      titleScreen.addEventListener('click', () => {
        if (this.state === 'title') {
          this._startFromTitle();
        }
      });
    }

    // resize
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  // â”€â”€ resizeCanvas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  resizeCanvas() {
    if (!this.canvas) return;

    const targetRatio = 1280 / 720;
    const windowW = window.innerWidth;
    const windowH = window.innerHeight;
    const windowRatio = windowW / windowH;

    let cssW, cssH;

    if (windowRatio > targetRatio) {
      // window is wider â€” height-constrained
      cssH = windowH;
      cssW = cssH * targetRatio;
    } else {
      // window is taller â€” width-constrained
      cssW = windowW;
      cssH = cssW / targetRatio;
    }

    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    this.canvas.style.position = 'absolute';
    this.canvas.style.left = ((windowW - cssW) / 2) + 'px';
    this.canvas.style.top = ((windowH - cssH) / 2) + 'px';
  }
}

// â”€â”€â”€ INITIALIZATION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

window.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  game.init();
});
