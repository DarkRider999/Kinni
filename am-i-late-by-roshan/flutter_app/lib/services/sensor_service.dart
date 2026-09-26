import 'dart:async';
import 'dart:math' as math;

import 'package:sensors_plus/sensors_plus.dart';

/// Aggregates motion sensors into driver-state signals, entirely on-device:
///  - steering variance: variance of yaw rate (gyroscope z, rad/s) over the
///    last minute; weaving/over-correction raises it,
///  - harsh events: horizontal acceleration spikes above 4 m/s^2 (hard
///    braking or swerving),
///  - speed variance: variance of GPS speed samples (fed in by navigation).
/// Only these aggregates are sent to the server, never raw sensor data.
class SensorService {
  static const _window = Duration(seconds: 60);
  static const harshThreshold = 4.0; // m/s^2

  final _yaw = <(DateTime, double)>[];
  final _speeds = <(DateTime, double)>[];
  int _harshEvents = 0;
  DateTime? _lastHarsh;
  StreamSubscription<GyroscopeEvent>? _gyroSub;
  StreamSubscription<UserAccelerometerEvent>? _accSub;
  DateTime? drivingSince;

  bool get running => _gyroSub != null;

  void start() {
    if (running) return;
    drivingSince = DateTime.now();
    _harshEvents = 0;
    _gyroSub = gyroscopeEventStream(samplingPeriod: SensorInterval.normalInterval).listen(
      (e) => _add(_yaw, e.z),
      onError: (_) {}, // sensor missing on this device: fatigue check still uses drive time
      cancelOnError: true,
    );
    _accSub = userAccelerometerEventStream(samplingPeriod: SensorInterval.normalInterval).listen(
      (e) {
        // Phone orientation is unknown, so use the full magnitude of user acceleration (gravity removed).
        final magnitude = math.sqrt(e.x * e.x + e.y * e.y + e.z * e.z);
        final now = DateTime.now();
        if (magnitude > harshThreshold && (_lastHarsh == null || now.difference(_lastHarsh!) > const Duration(seconds: 3))) {
          _harshEvents++;
          _lastHarsh = now;
        }
      },
      onError: (_) {},
      cancelOnError: true,
    );
  }

  void addSpeedSample(double kmh) => _add(_speeds, kmh);

  void _add(List<(DateTime, double)> buf, double v) {
    final now = DateTime.now();
    buf.add((now, v));
    while (buf.isNotEmpty && now.difference(buf.first.$1) > _window) {
      buf.removeAt(0);
    }
  }

  static double variance(Iterable<double> xs) {
    final list = xs.toList();
    if (list.length < 2) return 0;
    final mean = list.reduce((a, b) => a + b) / list.length;
    return list.map((x) => (x - mean) * (x - mean)).reduce((a, b) => a + b) / (list.length - 1);
  }

  double get steeringVariance => variance(_yaw.map((e) => e.$2));
  double get speedVariance => variance(_speeds.map((e) => e.$2));
  int get harshEventCount => _harshEvents;
  double get continuousDriveMinutes => drivingSince == null ? 0 : DateTime.now().difference(drivingSince!).inSeconds / 60;

  /// Call after a real break so time-on-task starts over.
  void resetDriveTimer() {
    drivingSince = DateTime.now();
    _harshEvents = 0;
  }

  Future<void> stop() async {
    await _gyroSub?.cancel();
    await _accSub?.cancel();
    _gyroSub = null;
    _accSub = null;
    _yaw.clear();
    _speeds.clear();
    drivingSince = null;
  }
}
