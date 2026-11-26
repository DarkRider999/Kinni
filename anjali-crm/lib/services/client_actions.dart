import 'dart:async';

import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';

import '../data/crm_database.dart';
import '../data/models.dart';
import '../data/phone.dart';
import '../ui/dialogs.dart';
import '../ui/widgets.dart';

typedef UrlOpener = Future<bool> Function(Uri uri);

/// Call, WhatsApp, email and maps actions on a client.
class ClientActions {
  ClientActions._();

  /// Opens a URL in another app. Tests replace it to record the URL.
  static UrlOpener opener = (uri) => launchUrl(uri, mode: LaunchMode.externalApplication);

  /// If the app has not gone to the background within this time after
  /// opening the dialer, the call is treated as not placed (no dialer, or the
  /// user stayed in the app) and the outcome prompt shows straight away.
  static Duration leaveGrace = const Duration(seconds: 2);

  static Future<bool> _open(BuildContext context, Uri uri, String what) async {
    bool ok;
    try {
      ok = await opener(uri);
    } catch (_) {
      ok = false;
    }
    if (!ok && context.mounted) showSnack(context, 'No app on this phone can open $what.');
    return ok;
  }

  /// Dials the client, then asks "How did the call go?" when the user comes
  /// back and logs the outcome (guide §13). Warns first if the number was
  /// flagged as a wrong number. Calls [onLogged] after an outcome is saved.
  static Future<void> call(BuildContext context, Client c, {VoidCallback? onLogged}) async {
    final number = c.phone.trim();
    if (digitsOnly(number).length < 7) {
      showSnack(context, '${c.name} has no phone number.');
      return;
    }
    final db = CrmDatabase.instance;
    if (c.id != null && await db.isFlaggedWrongNumber(c.id!)) {
      if (!context.mounted) return;
      final go = await confirm(context,
          title: 'Wrong number?', message: 'The last call to ${c.name} was marked as a wrong number. Call anyway?', action: 'Call');
      if (!go) return;
    }
    if (!context.mounted) return;
    final dialled = number.startsWith('+') ? '+${digitsOnly(number)}' : digitsOnly(number);
    if (!await _open(context, Uri(scheme: 'tel', path: dialled), 'phone calls')) return;
    await _waitForReturn();
    if (!context.mounted || c.id == null) return;
    final result = await showCallOutcomeSheet(context, c);
    if (result == null) return;
    try {
      await db.logCall(c.id!, result.outcome, notes: result.notes, callBackAt: result.callBackAt);
      if (context.mounted) showSnack(context, result.callBackAt == null ? 'Call logged.' : 'Call logged and followup scheduled.');
      onLogged?.call();
    } catch (e) {
      if (context.mounted) showSnack(context, 'Could not save the call: $e');
    }
  }

  /// Completes when the app comes back to the foreground after leaving it,
  /// or after [leaveGrace] if it never left.
  static Future<void> _waitForReturn() {
    final done = Completer<void>();
    var left = false;
    final listener = AppLifecycleListener(
      onHide: () => left = true,
      onResume: () {
        if (left && !done.isCompleted) done.complete();
      },
    );
    Timer(leaveGrace, () {
      if (!left && !done.isCompleted) done.complete();
    });
    return done.future.whenComplete(listener.dispose);
  }

  /// Opens a WhatsApp chat with the client, optionally with [text] typed in.
  static Future<void> whatsapp(BuildContext context, Client c, {String text = ''}) async {
    final digits = internationalDigits(c.whatsappNumber);
    if (digits == null) {
      showSnack(context, '${c.name} has no valid WhatsApp number.');
      return;
    }
    await _open(
      context,
      Uri.https('wa.me', '/$digits', text.trim().isEmpty ? null : {'text': text.trim()}),
      'WhatsApp links',
    );
  }

  static Future<void> email(BuildContext context, Client c) async {
    if (c.email.trim().isEmpty) {
      showSnack(context, '${c.name} has no email address.');
      return;
    }
    await _open(context, Uri(scheme: 'mailto', path: c.email.trim()), 'email');
  }

  static Future<void> map(BuildContext context, Client c) async {
    if (c.location.trim().isEmpty) {
      showSnack(context, '${c.name} has no location.');
      return;
    }
    await _open(context, Uri(scheme: 'geo', path: '0,0', queryParameters: {'q': c.location.trim()}), 'maps');
  }
}
