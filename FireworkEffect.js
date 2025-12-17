import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  Easing,
  withSpring,
  interpolate,
} from 'react-native-reanimated';

const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'];
const BURST_COLORS = ['#FFD700', '#FF6B6B', '#4ECDC4', '#FFA07A'];

// Rocket that shoots up
const Rocket = ({ originY, targetY, color, onComplete }) => {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    // Shoot up
    translateY.value = withSequence(
      withTiming(targetY - originY, {
        duration: 600,
        easing: Easing.out(Easing.quad),
      }),
      withTiming(targetY - originY + 20, {
        duration: 50,
        easing: Easing.in(Easing.quad),
      })
    );

    // Fade out as it reaches the top
    opacity.value = withSequence(
      withTiming(1, { duration: 500 }),
      withTiming(0, { duration: 150 })
    );

    // Trigger burst when rocket reaches top
    const timer = setTimeout(() => {
      onComplete?.();
    }, 620);

    return () => clearTimeout(timer);
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
      opacity: opacity.value,
    };
  });

  return (
    <Animated.View style={[styles.rocket, { top: originY, backgroundColor: color }, animatedStyle]}>
      <View style={styles.rocketFlame}>
        <View style={[styles.flame, { backgroundColor: '#FFA500' }]} />
      </View>
    </Animated.View>
  );
};

// Burst particles
const BurstParticle = ({ index, originX, originY, color }) => {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.5);

  useEffect(() => {
    const delay = index * 30;
    const duration = 800 + Math.random() * 400;
    
    // Random direction
    const angle = (Math.random() * 360) * (Math.PI / 180);
    const distance = 100 + Math.random() * 80;
    const endX = Math.cos(angle) * distance;
    const endY = Math.sin(angle) * distance;

    // Scale and fade in
    scale.value = withDelay(
      delay,
      withSequence(
        withSpring(1.2, { damping: 10, stiffness: 150 }),
        withTiming(0.8, { duration: duration * 0.7, easing: Easing.out(Easing.quad) })
      )
    );

    opacity.value = withDelay(
      delay,
      withSequence(
        withTiming(1, { duration: 50 }),
        withDelay(
          duration - 200,
          withTiming(0, { duration: 200 })
        )
      )
    );

    translateX.value = withDelay(
      delay,
      withTiming(endX, {
        duration,
        easing: Easing.out(Easing.quad),
      })
    );

    translateY.value = withDelay(
      delay,
      withTiming(endY, {
        duration,
        easing: Easing.out(Easing.quad),
      })
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
      opacity: opacity.value,
    };
  });

  // Vary the size for visual interest
  const size = 8 + Math.random() * 8;

  return (
    <Animated.View style={[styles.particle, { left: originX, top: originY }, animatedStyle]}>
      <View style={[styles.circle, { width: size, height: size, backgroundColor: color, borderRadius: size / 2 }]} />
    </Animated.View>
  );
};

const FireworkEffect = ({ active, onComplete }) => {
  const [showRocket, setShowRocket] = useState(false);
  const [showBurst, setShowBurst] = useState(false);
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    if (active) {
      // First show rocket
      setShowRocket(true);
      setShowBurst(false);
      setParticles([]);
      
      // After rocket explodes, show burst
      const burstTimer = setTimeout(() => {
        setShowRocket(false);
        setShowBurst(true);
        
        // Generate burst particles
        const newParticles = Array.from({ length: 30 }, (_, i) => ({
          id: i,
          color: BURST_COLORS[Math.floor(Math.random() * BURST_COLORS.length)],
        }));
        setParticles(newParticles);
      }, 620);

      // Clean up after everything
      const completeTimer = setTimeout(() => {
        setShowBurst(false);
        setParticles([]);
        onComplete?.();
      }, 2500);

      return () => {
        clearTimeout(burstTimer);
        clearTimeout(completeTimer);
      };
    } else {
      setShowRocket(false);
      setShowBurst(false);
      setParticles([]);
    }
  }, [active, onComplete]);

  if (!active) return null;

  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  
  const rocketStartY = screenHeight * 0.8;
  const rocketEndY = screenHeight * 0.2;
  const burstX = screenWidth / 2;
  const burstY = screenHeight * 0.2;
  const rocketColor = '#4ECDC4';

  return (
    <View style={styles.container} pointerEvents="none">
      {showRocket && (
        <Rocket
          originY={rocketStartY}
          targetY={rocketEndY}
          color={rocketColor}
          onComplete={() => {
            setShowBurst(true);
            const newParticles = Array.from({ length: 30 }, (_, i) => ({
              id: i,
              color: BURST_COLORS[Math.floor(Math.random() * BURST_COLORS.length)],
            }));
            setParticles(newParticles);
          }}
        />
      )}
      {showBurst && (
        <>
          {particles.map((particle) => (
            <BurstParticle
              key={particle.id}
              index={particle.id}
              originX={burstX}
              originY={burstY}
              color={particle.color}
            />
          ))}
        </>
      )}
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
    width: '100%',
    height: '100%',
    zIndex: 1000,
  },
  rocket: {
    position: 'absolute',
    left: '50%',
    width: 4,
    height: 20,
    marginLeft: -2,
  },
  rocketFlame: {
    position: 'absolute',
    bottom: -15,
    left: -3,
    width: 10,
    height: 15,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  flame: {
    width: 10,
    height: 15,
    borderBottomLeftRadius: 5,
    borderBottomRightRadius: 5,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  particle: {
    position: 'absolute',
  },
  circle: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});

export default FireworkEffect;
