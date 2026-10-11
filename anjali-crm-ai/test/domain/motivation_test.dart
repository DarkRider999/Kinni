import 'dart:math';

import 'package:anjali_crm_ai/core/constants/motivation_messages.dart';
import 'package:anjali_crm_ai/domain/services/motivation_picker.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('library holds 50–100 messages across all three themes', () {
    expect(kMotivationMessages.length, inInclusiveRange(50, 100));
    for (final theme in MotivationTheme.values) {
      expect(kMotivationMessages.where((m) => m.theme == theme), isNotEmpty);
    }
    expect(kMotivationMessages.map((m) => m.text).toSet().length, kMotivationMessages.length, reason: 'no duplicate texts');
  });

  test('never repeats a message within the last 30 picks', () {
    final rng = Random(42);
    var history = <int>[];
    final shown = <int>[];
    for (var i = 0; i < 500; i++) {
      final r = MotivationPicker.pick(total: kMotivationMessages.length, history: history, rng: rng);
      final window = shown.length > 30 ? shown.sublist(shown.length - 30) : shown;
      expect(window.contains(r.index), isFalse, reason: 'pick $i repeated ${r.index}');
      shown.add(r.index);
      history = r.history;
      expect(history.length, lessThanOrEqualTo(30));
    }
  });

  test('works when the library is smaller than the window', () {
    final r = MotivationPicker.pick(total: 3, history: const [0, 1], rng: Random(1));
    expect(r.index, 2);
  });
}
