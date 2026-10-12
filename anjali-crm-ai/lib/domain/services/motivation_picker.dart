import 'dart:math';

/// Chooses a random motivation index that was not shown in the last
/// [window] picks. Returns the index and the updated history.
abstract final class MotivationPicker {
  static ({int index, List<int> history}) pick({
    required int total,
    required List<int> history,
    required Random rng,
    int window = 30,
  }) {
    assert(total > 0);
    final w = window.clamp(0, total - 1);
    final recent = history.length > w ? history.sublist(history.length - w) : history;
    final blocked = recent.toSet();
    final candidates = [for (var i = 0; i < total; i++) if (!blocked.contains(i)) i];
    final index = candidates[rng.nextInt(candidates.length)];
    final next = [...recent, index];
    return (index: index, history: next.length > w ? next.sublist(next.length - w) : next);
  }
}
