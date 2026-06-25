    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    const BRICK_COLS = 10;
    const BRICK_ROWS = 6;
    const BRICK_WIDTH = 70;
    const BRICK_HEIGHT = 25;
    const BRICK_PADDING = 8;
    const BRICK_OFFSET_TOP = 60;
    const BRICK_OFFSET_LEFT = 35;

    const BRICK_COLORS = ['#ff006e', '#ff8500', '#ffdd00', '#00ff88', '#00a8ff', '#aa00ff'];

    let paddle = { x: 350, y: 560, width: 120, height: 15 };
    let ball = { x: 400, y: 530, radius: 10, dx: 5, dy: -5, trail: [] };
    let bricks = [];
    let particles = [];
    let score = 0;
    let lives = 3;
    let gameState = 'start';
    let shakeTime = 0;
    let shakeIntensity = 0;
    let keys = { left: false, right: false };
    let paddleTarget = null;

    function initBricks() {
      bricks = [];
      for (let row = 0; row < BRICK_ROWS; row++) {
        for (let col = 0; col < BRICK_COLS; col++) {
          bricks.push({
            x: BRICK_OFFSET_LEFT + col * (BRICK_WIDTH + BRICK_PADDING),
            y: BRICK_OFFSET_TOP + row * (BRICK_HEIGHT + BRICK_PADDING),
            width: BRICK_WIDTH,
            height: BRICK_HEIGHT,
            color: BRICK_COLORS[row],
            alive: true,
            pulse: Math.random() * Math.PI * 2
          });
        }
      }
    }

    function resetBall() {
      ball.x = paddle.x + paddle.width / 2;
      ball.y = paddle.y - ball.radius;
      ball.dx = 5 * (Math.random() > 0.5 ? 1 : -1);
      ball.dy = -5;
      ball.trail = [];
    }

    function createParticles(x, y, color) {
      for (let i = 0; i < 12; i++) {
        const angle = (Math.PI * 2 / 12) * i + Math.random() * 0.5;
        const speed = 2 + Math.random() * 3;
        particles.push({
          x: x,
          y: y,
          dx: Math.cos(angle) * speed,
          dy: Math.sin(angle) * speed,
          radius: 3 + Math.random() * 3,
          color: color,
          life: 1
        });
      }
    }

    function updateParticles() {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.dx;
        p.y += p.dy;
        p.dy += 0.1;
        p.life -= 0.02;
        if (p.life <= 0) {
          particles.splice(i, 1);
        }
      }
    }

    function drawParticles() {
      particles.forEach(p => {
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * p.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    }

    function drawPaddle() {
      ctx.save();
      ctx.fillStyle = '#00ffff';
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.roundRect(paddle.x, paddle.y, paddle.width, paddle.height, 8);
      ctx.fill();
      ctx.restore();
    }

    function drawBall() {
      ball.trail.forEach((pos, i) => {
        const alpha = (i / ball.trail.length) * 0.5;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, ball.radius * (i / ball.trail.length), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 25;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function drawBricks() {
      const time = Date.now() / 1000;
      bricks.forEach(brick => {
        if (!brick.alive) return;
        
        brick.pulse += 0.05;
        const pulseIntensity = 0.8 + Math.sin(brick.pulse) * 0.2;

        ctx.save();
        ctx.fillStyle = brick.color;
        ctx.shadowColor = brick.color;
        ctx.shadowBlur = 15 * pulseIntensity;
        ctx.beginPath();
        ctx.roundRect(brick.x, brick.y, brick.width, brick.height, 4);
        ctx.fill();
        
        ctx.fillStyle = `rgba(255,255,255,${0.3 * pulseIntensity})`;
        ctx.beginPath();
        ctx.roundRect(brick.x + 4, brick.y + 3, brick.width - 8, brick.height / 3, 2);
        ctx.fill();
        ctx.restore();
      });
    }

    function drawUI() {
      ctx.save();
      ctx.font = '24px Orbitron';
      ctx.fillStyle = '#00ffff';
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 10;
      ctx.fillText(`Score: ${score}`, 20, 35);
      ctx.fillText(`Lives: ${lives}`, 680, 35);
      ctx.restore();
    }

    function drawStartScreen() {
      ctx.save();
      ctx.fillStyle = '#00ffff';
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 30;
      ctx.font = '48px Orbitron';
      ctx.textAlign = 'center';
      ctx.fillText('NEON BREAKOUT', 400, 250);
      ctx.font = '24px Orbitron';
      ctx.fillText('Click to Start', 400, 320);
      ctx.restore();
    }

    function drawGameOver() {
      ctx.save();
      ctx.fillStyle = '#ff006e';
      ctx.shadowColor = '#ff006e';
      ctx.shadowBlur = 30;
      ctx.font = '48px Orbitron';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', 400, 250);
      ctx.font = '24px Orbitron';
      ctx.fillStyle = '#00ffff';
      ctx.shadowColor = '#00ffff';
      ctx.fillText(`Final Score: ${score}`, 400, 320);
      ctx.fillText('Click to Restart', 400, 380);
      ctx.restore();
    }

    function drawWin() {
      ctx.save();
      ctx.fillStyle = '#00ff88';
      ctx.shadowColor = '#00ff88';
      ctx.shadowBlur = 30;
      ctx.font = '48px Orbitron';
      ctx.textAlign = 'center';
      ctx.fillText('YOU WIN!', 400, 250);
      ctx.font = '24px Orbitron';
      ctx.fillStyle = '#ffdd00';
      ctx.shadowColor = '#ffdd00';
      ctx.fillText(`Final Score: ${score}`, 400, 320);
      ctx.fillText('Click to Play Again', 400, 380);
      ctx.restore();
    }

    function updatePaddle() {
      if (paddleTarget !== null) {
        const diff = paddleTarget - paddle.x - paddle.width / 2;
        paddle.x += diff * 0.3;
      }

      if (keys.left) paddle.x -= 8;
      if (keys.right) paddle.x += 8;

      if (paddle.x < 0) paddle.x = 0;
      if (paddle.x + paddle.width > canvas.width) paddle.x = canvas.width - paddle.width;
      
      if (gameState === 'start') {
        ball.x = paddle.x + paddle.width / 2;
      }
    }

    function updateBall() {
      if (gameState !== 'playing') return;

      ball.trail.push({ x: ball.x, y: ball.y });
      if (ball.trail.length > 10) ball.trail.shift();

      ball.x += ball.dx;
      ball.y += ball.dy;

      if (ball.x - ball.radius < 0 || ball.x + ball.radius > canvas.width) {
        ball.dx = -ball.dx;
        ball.x = ball.x < ball.radius ? ball.radius : canvas.width - ball.radius;
      }

      if (ball.y - ball.radius < 0) {
        ball.dy = -ball.dy;
        ball.y = ball.radius;
      }

      if (ball.y + ball.radius > paddle.y && 
          ball.y - ball.radius < paddle.y + paddle.height &&
          ball.x > paddle.x && 
          ball.x < paddle.x + paddle.width &&
          ball.dy > 0) {
        
        const hitPos = (ball.x - paddle.x) / paddle.width;
        const angle = (hitPos - 0.5) * Math.PI * 0.7;
        const speed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
        
        ball.dx = Math.sin(angle) * speed;
        ball.dy = -Math.abs(Math.cos(angle) * speed);
        ball.y = paddle.y - ball.radius;
        
        createParticles(ball.x, ball.y, '#00ffff');
      }

      if (ball.y > canvas.height) {
        lives--;
        shakeTime = 20;
        shakeIntensity = 10;
        createParticles(ball.x, canvas.height - 10, '#ff006e');
        
        if (lives <= 0) {
          gameState = 'gameover';
        } else {
          resetBall();
        }
      }

      bricks.forEach(brick => {
        if (!brick.alive) return;
        
        if (ball.x + ball.radius > brick.x && 
            ball.x - ball.radius < brick.x + brick.width &&
            ball.y + ball.radius > brick.y && 
            ball.y - ball.radius < brick.y + brick.height) {
          
          brick.alive = false;
          score += 10;
          createParticles(brick.x + brick.width / 2, brick.y + brick.height / 2, brick.color);
          
          const overlapLeft = ball.x + ball.radius - brick.x;
          const overlapRight = brick.x + brick.width - (ball.x - ball.radius);
          const overlapTop = ball.y + ball.radius - brick.y;
          const overlapBottom = brick.y + brick.height - (ball.y - ball.radius);
          
          const minOverlapX = Math.min(overlapLeft, overlapRight);
          const minOverlapY = Math.min(overlapTop, overlapBottom);
          
          if (minOverlapX < minOverlapY) {
            ball.dx = -ball.dx;
          } else {
            ball.dy = -ball.dy;
          }
        }
      });

      const aliveBricks = bricks.filter(b => b.alive);
      if (aliveBricks.length === 0) {
        gameState = 'win';
      }

      if (Math.abs(ball.dy) < 1) {
        ball.dy = ball.dy > 0 ? 1.5 : -1.5;
      }
    }

    function draw() {
      ctx.save();
      
      if (shakeTime > 0) {
        const shakeX = (Math.random() - 0.5) * shakeIntensity;
        const shakeY = (Math.random() - 0.5) * shakeIntensity;
        ctx.translate(shakeX, shakeY);
        shakeTime--;
      }

      ctx.fillStyle = '#0a0a1a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const gradient = ctx.createRadialGradient(400, 300, 0, 400, 300, 400);
      gradient.addColorStop(0, '#0f0f2a');
      gradient.addColorStop(1, '#0a0a1a');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      drawBricks();
      drawPaddle();
      
      if (gameState === 'playing' || gameState === 'start') {
        drawBall();
      }
      
      drawParticles();
      drawUI();

      if (gameState === 'start') {
        drawStartScreen();
      } else if (gameState === 'gameover') {
        drawGameOver();
      } else if (gameState === 'win') {
        drawWin();
      }

      ctx.restore();
    }

    function update() {
      updatePaddle();
      updateBall();
      updateParticles();
    }

    function gameLoop() {
      update();
      draw();
      requestAnimationFrame(gameLoop);
    }

    function getCanvasPos(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
      };
    }

    function handlePointerMove(clientX) {
      const pos = getCanvasPos(clientX, 0);
      paddleTarget = pos.x;
    }

    function handlePointerUp(clientX, clientY) {
      if (gameState === 'start') {
        gameState = 'playing';
        ball.dx = 5 * (Math.random() > 0.5 ? 1 : -1);
        ball.dy = -5;
      } else if (gameState === 'gameover' || gameState === 'win') {
        score = 0;
        lives = 3;
        initBricks();
        resetBall();
        particles = [];
        paddleTarget = null;
        gameState = 'start';
      }
    }

    canvas.addEventListener('mousemove', (e) => {
      handlePointerMove(e.clientX);
    });

    canvas.addEventListener('mouseleave', () => {
      paddleTarget = null;
    });

    canvas.addEventListener('click', (e) => {
      handlePointerUp(e.clientX, e.clientY);
    });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      handlePointerMove(e.touches[0].clientX);
    }, { passive: false });

    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      handlePointerMove(e.touches[0].clientX);
      if (gameState !== 'playing') {
        handlePointerUp(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      paddleTarget = null;
    }, { passive: false });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') {
        keys.left = true;
        e.preventDefault();
      } else if (e.key === 'ArrowRight' || e.key === 'd') {
        keys.right = true;
        e.preventDefault();
      } else if (e.key === ' ' || e.key === 'Enter') {
        handlePointerUp(null, null);
      }
    });

    document.addEventListener('keyup', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') {
        keys.left = false;
        e.preventDefault();
      } else if (e.key === 'ArrowRight' || e.key === 'd') {
        keys.right = false;
        e.preventDefault();
      }
    });

    initBricks();
    resetBall();
    gameLoop();
