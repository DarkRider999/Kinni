/// Asset paths. Backgrounds are Anjali's personal photos used softly
/// behind each tab (see docs/04-ui-wireframes.md).
abstract final class AppAssets {
  static const logo = 'assets/images/logo.jpg';
  static const logoRound = 'assets/images/logo_round.png';

  static const bgGold = 'assets/backgrounds/bg_gold.jpg';
  static const bgBlush = 'assets/backgrounds/bg_blush.jpg';
  static const bgLotus = 'assets/backgrounds/bg_lotus.jpg';

  static const lottieCelebration = 'assets/lottie/celebration.json';

  /// Background per bottom-nav tab: Home, Clients, Add Lead, Followups, Reports, Settings.
  static const tabBackgrounds = [bgGold, bgBlush, bgLotus, bgBlush, bgGold, bgLotus];
}

abstract final class AppInfo {
  static const name = 'Anjali CRM AI';
  static const tagline = 'Never Miss A Lead Again';
}
