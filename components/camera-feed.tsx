import { CameraView, useCameraPermissions } from "expo-camera";
import { DeviceMotion, Gyroscope, Magnetometer } from "expo-sensors";
import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from "react-native-reanimated";
import { ThemedText } from "./themed-text";
import { ThemedView } from "./themed-view";

interface CameraFeedProps {
  style?: any;
}

export function CameraFeed({ style }: CameraFeedProps) {
  const [facing, setFacing] = useState<"front" | "back">("back");
  const [permission, requestPermission] = useCameraPermissions();
  const [gyroscopeData, setGyroscopeData] = useState({ x: 0, y: 0, z: 0 });
  const [isGyroscopeAvailable, setIsGyroscopeAvailable] = useState(false);
  const [heading, setHeading] = useState(0);
  const [dampedHeading, setDampedHeading] = useState(0);
  const [direction, setDirection] = useState("N");
  const [isMagnetometerAvailable, setIsMagnetometerAvailable] = useState(false);
  const [deviceMotionData, setDeviceMotionData] = useState<any>(null);

  // Animated value for smooth compass rotation
  const compassRotation = useDerivedValue(() => {
    return withTiming(-dampedHeading, { duration: 100 });
  }, [dampedHeading]);

  // Sensor fusion: Calculate heading accounting for device orientation
  const calculateFusedHeading = useCallback(
    (magnetometer: any, rotation: any) => {
      if (!magnetometer || !rotation) {
        return _degree(_angle(magnetometer));
      }

      // Get device rotation quaternion components (only using alpha for yaw)
      const { alpha } = rotation;

      // Transform magnetometer vector from device coordinates to world coordinates
      // Using negative angle to match iPhone compass coordinate system
      const cos = Math.cos(-alpha);
      const sin = Math.sin(-alpha);

      const mx_world = magnetometer.x * cos - magnetometer.y * sin;
      const my_world = magnetometer.x * sin + magnetometer.y * cos;

      // Calculate heading from world-coordinate magnetic field
      let heading = Math.atan2(my_world, mx_world) * (180 / Math.PI);

      // Normalize to 0-360 degrees
      heading = (heading + 360) % 360;

      return Math.round(heading);
    },
    []
  );

  // Gyroscope setup
  useEffect(() => {
    let gyroSubscription: any;

    const setupGyroscope = async () => {
      const isAvailable = await Gyroscope.isAvailableAsync();
      setIsGyroscopeAvailable(isAvailable);

      if (isAvailable) {
        Gyroscope.setUpdateInterval(100); // Update every 100ms
        gyroSubscription = Gyroscope.addListener((gyroscopeData) => {
          setGyroscopeData(gyroscopeData);
        });
      }
    };

    setupGyroscope();

    return () => {
      if (gyroSubscription) {
        gyroSubscription.remove();
      }
    };
  }, []);

  // Advanced compass with sensor fusion for camera orientation
  useEffect(() => {
    let magnetometerSubscription: any;
    let deviceMotionSubscription: any;

    const setupCompass = async () => {
      const magnetometerAvailable = await Magnetometer.isAvailableAsync();
      const deviceMotionAvailable = await DeviceMotion.isAvailableAsync();

      setIsMagnetometerAvailable(magnetometerAvailable);

      if (magnetometerAvailable) {
        Magnetometer.setUpdateInterval(16); // ~60fps for smoother updates
        magnetometerSubscription = Magnetometer.addListener((data: any) => {
          // If we have both sensors, use sensor fusion for accurate heading
          if (deviceMotionAvailable && deviceMotionData?.rotation) {
            const fusedHeading = calculateFusedHeading(
              data,
              deviceMotionData.rotation
            );
            const dir = _direction(fusedHeading);
            setHeading(fusedHeading); // Raw undamped heading for debug
            setDirection(dir);
          } else {
            // Fallback to simple calculation
            const angle = _angle(data);
            const degree = _degree(angle);
            const dir = _direction(degree);
            setHeading(degree);
            setDirection(dir);
          }
        });
      }

      if (deviceMotionAvailable) {
        DeviceMotion.setUpdateInterval(16); // ~60fps for smoother updates
        deviceMotionSubscription = DeviceMotion.addListener((motion: any) => {
          setDeviceMotionData(motion);
        });
      }
    };

    setupCompass();

    return () => {
      if (magnetometerSubscription) magnetometerSubscription.remove();
      if (deviceMotionSubscription) deviceMotionSubscription.remove();
    };
  }, [deviceMotionData, calculateFusedHeading]);

  // Damped heading for smooth visual compass
  useEffect(() => {
    setDampedHeading((prev) => {
      // Balanced damping for responsive yet smooth visual movement
      const damping = 0.4; // Increased for better responsiveness
      const diff = heading - prev;

      // Handle 360° wraparound
      let adjustedDiff = diff;
      if (Math.abs(diff) > 180) {
        adjustedDiff = diff > 0 ? diff - 360 : diff + 360;
      }

      const newDamped = prev + adjustedDiff * damping;
      return newDamped;
    });
  }, [heading]);

  // Animated style for smooth compass rotation
  const animatedCompassStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${compassRotation.value}deg` }],
    };
  });

  // Angle calculation from GitHub implementation
  const _angle = (magnetometer: any) => {
    let angle = 0;
    if (magnetometer) {
      let { x, y } = magnetometer;
      if (Math.atan2(y, x) >= 0) {
        angle = Math.atan2(y, x) * (180 / Math.PI);
      } else {
        angle = (Math.atan2(y, x) + 2 * Math.PI) * (180 / Math.PI);
      }
    }
    return Math.round(angle);
  };

  // Direction mapping from GitHub implementation
  const _direction = (degree: number) => {
    if (degree >= 22.5 && degree < 67.5) {
      return "NE";
    } else if (degree >= 67.5 && degree < 112.5) {
      return "E";
    } else if (degree >= 112.5 && degree < 157.5) {
      return "SE";
    } else if (degree >= 157.5 && degree < 202.5) {
      return "S";
    } else if (degree >= 202.5 && degree < 247.5) {
      return "SW";
    } else if (degree >= 247.5 && degree < 292.5) {
      return "W";
    } else if (degree >= 292.5 && degree < 337.5) {
      return "NW";
    } else {
      return "N";
    }
  };

  // Degree adjustment to match device orientation from GitHub implementation
  const _degree = (magnetometer: number) => {
    return magnetometer - 90 >= 0 ? magnetometer - 90 : magnetometer + 271;
  };

  // Camera permission handling
  if (!permission) {
    return (
      <ThemedView style={[styles.container, style]}>
        <Text>Requesting camera permission...</Text>
      </ThemedView>
    );
  }

  if (!permission.granted) {
    return (
      <ThemedView style={[styles.container, style]}>
        <Text style={styles.message}>
          Camera access is required for this feature
        </Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  const toggleCameraFacing = () => {
    setFacing((current) => (current === "back" ? "front" : "back"));
  };

  return (
    <View style={[styles.container, style]}>
      <CameraView style={styles.camera} facing={facing} mode="video" />

      {/* Compass */}
      {isMagnetometerAvailable && (
        <View style={styles.compassContainer}>
          <Animated.View style={[styles.compass, animatedCompassStyle]}>
            {/* Cardinal directions */}
            <Text style={[styles.cardinalDirection, styles.north]}>N</Text>
            <Text style={[styles.cardinalDirection, styles.south]}>S</Text>
            <Text style={[styles.cardinalDirection, styles.east]}>E</Text>
            <Text style={[styles.cardinalDirection, styles.west]}>W</Text>

            {/* Compass needle */}
            <View style={styles.needleContainer}>
              <View style={styles.needleNorth} />
              <View style={styles.needleSouth} />
            </View>
          </Animated.View>
          <ThemedText style={styles.headingText}>
            {direction} {Math.round(dampedHeading)}°
          </ThemedText>
        </View>
      )}

      {/* Gyroscope data display */}
      {isGyroscopeAvailable && (
        <View style={styles.gyroscopeInfo}>
          <ThemedText style={styles.gyroscopeText}>
            Gyro: x:{gyroscopeData.x.toFixed(2)} y:
            {gyroscopeData.y.toFixed(2)} z:{gyroscopeData.z.toFixed(2)}
          </ThemedText>
        </View>
      )}

      {/* Compass debug display */}
      {isMagnetometerAvailable && (
        <View style={[styles.gyroscopeInfo, { bottom: 80 }]}>
          <ThemedText style={styles.gyroscopeText}>
            {direction} {Math.round(heading)}°
          </ThemedText>
        </View>
      )}

      {/* Damped value display */}
      {isMagnetometerAvailable && (
        <View style={styles.dampedDisplay}>
          <ThemedText style={styles.dampedText}>
            Damped: {dampedHeading.toFixed(1)}°
          </ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  camera: {
    flex: 1,
    width: "100%",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "transparent",
  },
  topControls: {
    flexDirection: "row",
    justifyContent: "flex-end",
    padding: 20,
    paddingTop: 50,
  },
  flipButton: {
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  flipButtonText: {
    fontSize: 20,
    color: "white",
  },
  gyroscopeInfo: {
    position: "absolute",
    bottom: 20,
    left: 20,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    padding: 10,
    borderRadius: 8,
  },
  gyroscopeText: {
    color: "white",
    fontSize: 12,
    fontFamily: "monospace",
  },
  message: {
    textAlign: "center",
    paddingBottom: 10,
  },
  button: {
    backgroundColor: "#007AFF",
    padding: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  compassContainer: {
    position: "absolute",
    top: 100,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  compass: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.8)",
  },
  cardinalDirection: {
    position: "absolute",
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  north: {
    top: 8,
  },
  south: {
    bottom: 8,
  },
  east: {
    right: 8,
  },
  west: {
    left: 8,
  },
  needleContainer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  needleNorth: {
    width: 3,
    height: 45,
    backgroundColor: "red",
    borderRadius: 1.5,
  },
  needleSouth: {
    width: 3,
    height: 45,
    backgroundColor: "white",
    borderRadius: 1.5,
    marginTop: 2,
  },
  headingText: {
    marginTop: 8,
    color: "white",
    fontSize: 14,
    fontWeight: "bold",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  dampedDisplay: {
    position: "absolute",
    bottom: 20,
    right: 20,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  dampedText: {
    color: "white",
    fontSize: 12,
    fontFamily: "monospace",
  },
});
