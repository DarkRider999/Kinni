import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Parent-mode elevation (SPEC §9.3 / §4.2). Held in memory only; cleared on
/// timeout or when the app is backgrounded. This is the architectural
/// boundary between child mode and parent mode — not merely a UI flag.
class ParentSession {
  const ParentSession({this.elevatedUntil});

  final DateTime? elevatedUntil;

  /// Whether a parent session is still valid at [now].
  bool isElevatedAt(DateTime now) =>
      elevatedUntil != null && now.isBefore(elevatedUntil!);
}

class ParentSessionNotifier extends Notifier<ParentSession> {
  /// Elevation lifetime (SPEC §9.3).
  static const Duration ttl = Duration(minutes: 5);

  @override
  ParentSession build() => const ParentSession();

  /// Grant parent mode for [ttl] from [now] (defaults to the wall clock).
  void elevate({DateTime? now}) {
    final DateTime base = now ?? DateTime.now();
    state = ParentSession(elevatedUntil: base.add(ttl));
  }

  /// Drop parent mode (on explicit exit or app background).
  void clear() => state = const ParentSession();
}

final parentSessionProvider =
    NotifierProvider<ParentSessionNotifier, ParentSession>(
  ParentSessionNotifier.new,
);
