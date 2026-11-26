import 'package:anjali_crm_ai/core/constants/motivation_messages.dart';
import 'package:anjali_crm_ai/features/motivation/motivation_dialog.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('shows the message and closes only via the heart', (tester) async {
    const msg = MotivationMessage('You are made of stardust.', MotivationTheme.universe);
    await tester.pumpWidget(MaterialApp(
      home: Builder(
        builder: (context) => Scaffold(
          body: Center(child: ElevatedButton(onPressed: () => MotivationDialog.show(context, msg), child: const Text('open'))),
        ),
      ),
    ));
    await tester.tap(find.text('open'));
    await tester.pump(const Duration(milliseconds: 600));

    expect(find.textContaining('stardust'), findsOneWidget);
    expect(find.text('UNIVERSE'), findsOneWidget);
    expect(find.byIcon(Icons.favorite_rounded), findsOneWidget);

    // Tapping the barrier must not dismiss it.
    await tester.tapAt(const Offset(5, 5));
    await tester.pump(const Duration(milliseconds: 600));
    expect(find.textContaining('stardust'), findsOneWidget);

    await tester.tap(find.byIcon(Icons.favorite_rounded));
    await tester.pump(const Duration(milliseconds: 700));
    await tester.pump(const Duration(milliseconds: 600));
    await tester.pump(const Duration(milliseconds: 600));
    expect(find.textContaining('stardust'), findsNothing);
  });
}
