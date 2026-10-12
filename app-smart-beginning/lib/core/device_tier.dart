import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Device performance tier (SPEC §9.4). Drives animation/particle budgets so
/// heavy screens stay at 60 fps on low-end Android.
enum DeviceTier { high, mid, low }

/// Resolved at bootstrap after real detection (RAM/CPU/reduce-motion).
/// Phase-0 defaults to [DeviceTier.mid]; override this provider in `main`
/// once detection lands.
final deviceTierProvider = Provider<DeviceTier>((ref) => DeviceTier.mid);
