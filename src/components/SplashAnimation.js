import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  StatusBar,
} from 'react-native';
import { fonts } from '../theme/typography';

const { width, height } = Dimensions.get('window');

export default function SplashAnimation({ onFinish }) {
  // Animated values
  const glowScale = useRef(new Animated.Value(0.2)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0)).current;
  const logoRotate = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(20)).current;
  const splashOpacity = useRef(new Animated.Value(1)).current;

  const onFinishRef = useRef(onFinish);

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    // Run animations in sequence and parallel
    Animated.sequence([
      // 1. Initial fade-in of background glow
      Animated.parallel([
        Animated.timing(glowOpacity, {
          toValue: 0.6,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(glowScale, {
          toValue: 1.5,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
      // 2. Spring-scale and rotate the logo
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(logoRotate, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
      // 3. Fade in text and slide up
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(textTranslateY, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
      // 4. Hold splash then fade out the whole overlay
      Animated.delay(1000),
      Animated.timing(splashOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (onFinishRef.current) {
        onFinishRef.current();
      }
    });
  }, []);

  // Interpolate rotation
  const spin = logoRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={[styles.container, { opacity: splashOpacity }]}>
      <StatusBar barStyle="light-content" backgroundColor="#0C0B14" />

      {/* Ambient background glow */}
      <Animated.View
        style={[
          styles.glow,
          {
            opacity: glowOpacity,
            transform: [{ scale: glowScale }],
          },
        ]}
      />

      {/* Central logo container */}
      <View style={styles.logoWrapper}>
        <Animated.View
          style={[
            styles.logoContainer,
            {
              transform: [{ scale: logoScale }, { rotate: spin }],
            },
          ]}
        >
          {/* Overlapping premium geometric lines representation of "E" and "L" (EstateLogic) */}
          <View style={styles.outerRing}>
            <View style={styles.innerRing} />
            <View style={styles.diagonalAccent} />
          </View>
        </Animated.View>

        {/* Brand Text */}
        <Animated.View
          style={[
            styles.textContainer,
            {
              opacity: textOpacity,
              transform: [{ translateY: textTranslateY }],
            },
          ]}
        >
          <Text style={styles.titleText}>TENURA</Text>
          <Text style={styles.subtitleText}>PREMIUM LIVING SOLUTIONS</Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0C0B14', // Sleek dark mode background
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999,
    elevation: 99999,
  },
  glow: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(0, 229, 255, 0.25)', // Neon Cyan glow base
    shadowColor: '#D84CFF', // Neon magenta secondary glow
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 100,
    elevation: 10,
  },
  logoWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  logoContainer: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 5,
    borderColor: '#00E5FF', // Neon cyan border
    borderTopColor: '#D84CFF', // Neon magenta accent
    borderRightColor: '#D84CFF',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  innerRing: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 4,
    borderColor: '#F5F3F7', // Ice-white
    borderBottomColor: 'transparent',
  },
  diagonalAccent: {
    position: 'absolute',
    width: 5,
    height: 40,
    backgroundColor: '#00FF9D', // Glowing neon green
    transform: [{ rotate: '45deg' }],
    bottom: 12,
    right: 22,
    borderRadius: 3,
  },
  textContainer: {
    alignItems: 'center',
    gap: 6,
  },
  titleText: {
    fontFamily: fonts.manropeBold || 'System',
    fontSize: 32,
    fontWeight: '800',
    color: '#F5F3F7',
    letterSpacing: 1.5,
  },
  subtitleText: {
    fontFamily: fonts.interMedium || 'System',
    fontSize: 10,
    fontWeight: '600',
    color: '#8E8A9F',
    letterSpacing: 4,
  },
});
