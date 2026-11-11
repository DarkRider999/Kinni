import 'package:url_launcher/url_launcher.dart';

import '../utils/phone_utils.dart';

/// External intents: dialer, WhatsApp, maps, email.
abstract final class Launcher {
  static Future<bool> call(String phone) =>
      launchUrl(Uri(scheme: 'tel', path: PhoneUtils.dialable(phone)));

  static Future<bool> whatsapp(String phone, {String text = ''}) {
    final number = PhoneUtils.international(phone);
    final uri = Uri.https('wa.me', '/$number', text.isEmpty ? null : {'text': text});
    return launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  /// Turn-by-turn navigation in Google Maps, falling back to the web URL.
  static Future<bool> navigate(double lat, double lng) async {
    final nav = Uri.parse('google.navigation:q=$lat,$lng');
    if (await canLaunchUrl(nav)) return launchUrl(nav);
    return launchUrl(
      Uri.https('www.google.com', '/maps/dir/', {'api': '1', 'destination': '$lat,$lng'}),
      mode: LaunchMode.externalApplication,
    );
  }

  static Future<bool> mapSearch(String query) => launchUrl(
        Uri.https('www.google.com', '/maps/search/', {'api': '1', 'query': query}),
        mode: LaunchMode.externalApplication,
      );

  static Future<bool> email(String to, {String subject = ''}) =>
      launchUrl(Uri(scheme: 'mailto', path: to, query: subject.isEmpty ? null : 'subject=${Uri.encodeComponent(subject)}'));
}
