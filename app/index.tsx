import { CameraFeed } from "@/components/camera-feed";
import { StyleSheet } from "react-native";

export default function HomeScreen() {
  return <CameraFeed style={styles.container} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
