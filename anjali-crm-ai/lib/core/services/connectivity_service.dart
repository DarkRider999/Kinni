import 'package:connectivity_plus/connectivity_plus.dart';

/// Online/offline signal used to trigger background sync.
abstract final class Net {
  static final _c = Connectivity();

  static bool _online(List<ConnectivityResult> r) => r.any((x) => x != ConnectivityResult.none);

  static Future<bool> isOnline() async => _online(await _c.checkConnectivity());

  /// Emits `true` whenever connectivity is (re)gained, `false` when lost.
  static Stream<bool> changes() => _c.onConnectivityChanged.map(_online).distinct();
}
