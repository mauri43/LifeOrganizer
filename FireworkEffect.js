import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Dimensions, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const FIREWORK_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      background: transparent !important;
      overflow: hidden;
      width: 100%;
      height: 100%;
    }
    canvas {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: transparent !important;
    }
  </style>
</head>
<body>
  <canvas id="canvas"></canvas>
  <script>
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.scale(dpr, dpr);
    }
    resize();
    window.addEventListener('resize', resize);

    const colors = [
      'rgba(255, 107, 107, 1)',
      'rgba(255, 159, 67, 1)',
      'rgba(255, 215, 0, 1)',
      'rgba(78, 205, 196, 1)',
      'rgba(255, 255, 255, 1)',
      'rgba(167, 139, 250, 1)',
      'rgba(251, 191, 36, 1)',
    ];

    class Particle {
      constructor(x, y, color, velocity, size, type = 'spark') {
        this.x = x;
        this.y = y;
        this.color = color;
        this.velocity = velocity;
        this.size = size;
        this.type = type;
        this.alpha = 1;
        this.decay = type === 'glitter' ? 0.035 : 0.025 + Math.random() * 0.012;
        this.gravity = type === 'glitter' ? 0.07 : 0.12;
        this.friction = 0.98;
        this.trail = [];
        this.trailLength = type === 'glitter' ? 3 : 6;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.2;
        this.twinkle = Math.random() * Math.PI * 2;
      }

      update() {
        this.trail.push({ x: this.x, y: this.y, alpha: this.alpha });
        if (this.trail.length > this.trailLength) {
          this.trail.shift();
        }
        this.velocity.x *= this.friction;
        this.velocity.y *= this.friction;
        this.velocity.y += this.gravity;
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.alpha -= this.decay;
        this.rotation += this.rotationSpeed;
        this.twinkle += 0.15;
      }

      draw(ctx) {
        for (let i = 0; i < this.trail.length; i++) {
          const t = this.trail[i];
          const progress = i / this.trail.length;
          const trailAlpha = progress * t.alpha * 0.4;
          const trailSize = this.size * progress * 0.8;
          ctx.beginPath();
          ctx.arc(t.x, t.y, trailSize, 0, Math.PI * 2);
          ctx.fillStyle = this.color.replace(/[\\d.]+\\)$/, trailAlpha + ')');
          ctx.fill();
        }

        let currentAlpha = this.alpha;
        if (this.type === 'glitter') {
          currentAlpha *= 0.5 + Math.sin(this.twinkle) * 0.5;
        }

        ctx.save();
        ctx.globalAlpha = currentAlpha;
        ctx.shadowBlur = this.type === 'glitter' ? 8 : 12;
        ctx.shadowColor = this.color;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        if (this.type === 'glitter') {
          ctx.fillStyle = this.color;
          ctx.beginPath();
          for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2;
            const outerX = Math.cos(angle) * this.size;
            const outerY = Math.sin(angle) * this.size;
            const innerAngle = angle + Math.PI / 4;
            const innerX = Math.cos(innerAngle) * this.size * 0.3;
            const innerY = Math.sin(innerAngle) * this.size * 0.3;
            if (i === 0) ctx.moveTo(outerX, outerY);
            else ctx.lineTo(outerX, outerY);
            ctx.lineTo(innerX, innerY);
          }
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, this.size, 0, Math.PI * 2);
          ctx.fillStyle = this.color;
          ctx.fill();
        }
        ctx.restore();
      }
    }

    class RocketParticle {
      constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = 3 + Math.random() * 3;
        this.alpha = 1;
        this.decay = 0.05 + Math.random() * 0.03;
        this.velocity = {
          x: (Math.random() - 0.5) * 2,
          y: Math.random() * 2 + 1
        };
        this.colors = ['rgba(255, 200, 100, 1)', 'rgba(255, 150, 50, 1)', 'rgba(255, 100, 50, 1)'];
        this.color = this.colors[Math.floor(Math.random() * this.colors.length)];
      }

      update() {
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.alpha -= this.decay;
        this.size *= 0.95;
      }

      draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.restore();
      }
    }

    let particles = [];
    let rocketParticles = [];
    let rocket = null;
    let animationId = null;

    function createExplosion(x, y) {
      for (let i = 0; i < 60; i++) {
        const angle = (Math.PI * 2 / 60) * i;
        const speed = 3 + Math.random() * 5;
        const color = colors[Math.floor(Math.random() * colors.length)];
        particles.push(new Particle(x, y, color,
          { x: Math.cos(angle) * speed + (Math.random() - 0.5) * 2, y: Math.sin(angle) * speed + (Math.random() - 0.5) * 2 },
          1.5 + Math.random() * 2, 'spark'
        ));
      }

      for (let i = 0; i < 30; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 5 + Math.random() * 4;
        const color = colors[Math.floor(Math.random() * colors.length)];
        particles.push(new Particle(x, y, color,
          { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
          1 + Math.random() * 1.5, 'spark'
        ));
      }

      for (let i = 0; i < 25; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 3;
        particles.push(new Particle(
          x + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 30,
          'rgba(255, 255, 255, 1)',
          { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed - 1 },
          2 + Math.random() * 2, 'glitter'
        ));
      }

      setTimeout(() => {
        for (let i = 0; i < 20; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 2 + Math.random() * 3;
          const color = colors[Math.floor(Math.random() * colors.length)];
          particles.push(new Particle(
            x + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 40,
            color, { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
            1 + Math.random() * 1.5, 'spark'
          ));
        }
      }, 100);
    }

    function animate() {
      const w = window.innerWidth;
      const h = window.innerHeight;

      // Clear with semi-transparent black for trail effect
      ctx.fillStyle = 'rgba(0, 0, 0, 0.04)';
      ctx.fillRect(0, 0, w, h);

      if (rocket) {
        for (let i = 0; i < 3; i++) {
          rocketParticles.push(new RocketParticle(
            rocket.x + (Math.random() - 0.5) * 6,
            rocket.y + 5
          ));
        }

        rocket.y += rocket.velocity;
        rocket.velocity *= 0.99;

        ctx.save();
        ctx.shadowBlur = 20;
        ctx.shadowColor = 'rgba(255, 200, 100, 1)';
        ctx.beginPath();
        ctx.arc(rocket.x, rocket.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 1)';
        ctx.fill();
        ctx.restore();

        if (rocket.y <= rocket.targetY) {
          createExplosion(rocket.x, rocket.y);
          rocket = null;
        }
      }

      rocketParticles = rocketParticles.filter(p => p.alpha > 0);
      rocketParticles.forEach(p => {
        p.update();
        p.draw(ctx);
      });

      particles = particles.filter(p => p.alpha > 0);
      particles.forEach(p => {
        p.update();
        p.draw(ctx);
      });

      if (particles.length > 0 || rocketParticles.length > 0 || rocket) {
        animationId = requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, w, h);
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage('complete');
        }
      }
    }

    function launchFirework() {
      const w = window.innerWidth;
      const h = window.innerHeight;

      ctx.clearRect(0, 0, w, h);
      particles = [];
      rocketParticles = [];

      rocket = {
        x: w / 2,
        y: h + 10,
        targetY: h * 0.40,
        velocity: -35
      };

      if (animationId) cancelAnimationFrame(animationId);
      animate();
    }

    // Auto-launch on load
    launchFirework();
  </script>
</body>
</html>
`;

const FireworkEffect = ({ active, onComplete }) => {
  const webViewRef = useRef(null);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (active) {
      // Force remount WebView to restart animation
      setKey(prev => prev + 1);

      // Set timeout for completion
      const timer = setTimeout(() => {
        onComplete?.();
      }, 2800);

      return () => clearTimeout(timer);
    }
  }, [active, onComplete]);

  if (!active) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      <WebView
        key={key}
        ref={webViewRef}
        source={{ html: FIREWORK_HTML }}
        style={styles.webview}
        scrollEnabled={false}
        bounces={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={['*']}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        // iOS specific for transparency
        opaque={false}
        // Android specific
        androidLayerType="hardware"
        androidHardwareAccelerationDisabled={false}
        // Allow mixed content
        mixedContentMode="always"
        // Styling
        containerStyle={styles.webviewContainer}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    elevation: 9999,
  },
  webviewContainer: {
    backgroundColor: 'transparent',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

export default FireworkEffect;
