import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:smart_beginning/features/onboarding/age_selection_screen.dart';

void main() {
  testWidgets('Age Selection renders a grid with the first bands visible',
      (tester) async {
    await tester.pumpWidget(const MaterialApp(home: AgeSelectionScreen()));

    // The grid is lazy, so only assert cards that are on the first screen;
    // the full set of six is covered by the kAgeBands unit test below.
    expect(find.byType(GridView), findsOneWidget);
    expect(find.text('0–12 Months'), findsOneWidget);
    expect(find.text('1–2 Years'), findsOneWidget);
  });

  testWidgets('every age band label can be scrolled into view',
      (tester) async {
    await tester.pumpWidget(const MaterialApp(home: AgeSelectionScreen()));

    for (final band in kAgeBands) {
      await tester.scrollUntilVisible(find.text(band.label), 200);
      expect(find.text(band.label), findsOneWidget);
    }
  });

  test('there are exactly six age bands', () {
    expect(kAgeBands.length, 6);
  });
}
