import 'package:anjali_crm_ai/domain/entities/client.dart';
import 'package:anjali_crm_ai/domain/services/duplicate_detector.dart';
import 'package:anjali_crm_ai/features/clients/client_form_screen.dart';
import 'package:anjali_crm_ai/providers/app_providers.dart';
import 'package:anjali_crm_ai/providers/crm_actions.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

/// Records saves instead of writing to storage.
class _RecordingActions extends CrmActions {
  _RecordingActions(super.ref);
  final saved = <Client>[];

  @override
  DuplicateMatch? findDuplicate(Client candidate) => null;

  @override
  Future<Client> saveClient(Client client, {DateTime? followupAt, String? followupNote}) async {
    saved.add(client);
    return client;
  }
}

void main() {
  testWidgets('Save at the bottom of the form still validates the name and phone at the top', (tester) async {
    // Phone-sized screen: the form is several screens tall.
    tester.view.physicalSize = const Size(1080, 2340);
    tester.view.devicePixelRatio = 2.6;
    addTearDown(tester.view.reset);

    // Created only if the form reaches the save step.
    _RecordingActions? actions;
    await tester.pumpWidget(ProviderScope(
      overrides: [
        productsProvider.overrideWith((ref) => Stream.value(const [])),
        crmActionsProvider.overrideWith((ref) => actions = _RecordingActions(ref)),
      ],
      child: const MaterialApp(home: ClientFormScreen()),
    ));
    await tester.pumpAndSettle();

    // Leave name and phone empty, scroll to the bottom and tap Save there.
    final save = find.text('Save lead');
    await tester.scrollUntilVisible(save, 400, scrollable: find.byType(Scrollable).first);
    await tester.pumpAndSettle();
    await tester.tap(save);
    await tester.pump();

    expect(actions?.saved ?? const <Client>[], isEmpty, reason: 'a lead with no name or phone must not be saved');
    expect(find.text('Please fix the highlighted fields'), findsOneWidget);
    await tester.pumpAndSettle();
    // The form scrolls back so the first error is visible.
    expect(find.text('Enter at least 2 characters'), findsOneWidget);
  });
}
