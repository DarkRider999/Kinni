import 'dart:async';
import 'dart:convert';
import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../models/driver_profile.dart';
import '../models/notification_preference.dart';
import '../models/place.dart';
import '../models/route_option.dart';
import '../models/trip.dart';

class ApiException implements Exception {
  final int status;
  final String message;
  const ApiException(this.status, this.message);

  bool get isUnauthorized => status == 401;

  @override
  String toString() => message;
}

String isoUtc(DateTime t) {
  final u = t.toUtc();
  return DateTime.utc(u.year, u.month, u.day, u.hour, u.minute, u.second).toIso8601String();
}

/// Talks to the Node backend. The JWT is attached to every call; the server
/// derives the user from it (the app never sends a user id).
class ApiClient extends ChangeNotifier {
  static const _kBaseUrl = 'api_base_url';
  static const _kToken = 'auth_token';
  static const _kName = 'display_name';

  /// Override at build time: flutter run --dart-define=API_BASE_URL=https://api.example.com
  static const _definedBaseUrl = String.fromEnvironment('API_BASE_URL');

  final http.Client _http;
  late SharedPreferences _prefs;
  String _baseUrl = '';
  String? _token;
  String? displayName;

  ApiClient({http.Client? httpClient}) : _http = httpClient ?? http.Client();

  static String get defaultBaseUrl {
    if (_definedBaseUrl.isNotEmpty) return _definedBaseUrl;
    // The Android emulator reaches the host machine at 10.0.2.2.
    if (!kIsWeb && Platform.isAndroid) return 'http://10.0.2.2:3000';
    return 'http://localhost:3000';
  }

  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
    _baseUrl = _prefs.getString(_kBaseUrl) ?? defaultBaseUrl;
    _token = _prefs.getString(_kToken);
    displayName = _prefs.getString(_kName);
  }

  String get baseUrl => _baseUrl;
  String? get token => _token;
  bool get isLoggedIn => _token != null;

  Future<void> setBaseUrl(String url) async {
    _baseUrl = url.trim().replaceAll(RegExp(r'/+$'), '');
    await _prefs.setString(_kBaseUrl, _baseUrl);
    notifyListeners();
  }

  Future<void> _saveSession(Map<String, dynamic> body) async {
    _token = body['token'] as String;
    final user = body['user'] as Map<String, dynamic>;
    displayName = (user['display_name'] as String?) ?? (user['email'] as String).split('@').first;
    await _prefs.setString(_kToken, _token!);
    await _prefs.setString(_kName, displayName!);
    notifyListeners();
  }

  Future<void> logout() async {
    _token = null;
    displayName = null;
    await _prefs.remove(_kToken);
    await _prefs.remove(_kName);
    notifyListeners();
  }

  Uri uri(String path, [Map<String, String>? query]) => Uri.parse('$_baseUrl$path').replace(queryParameters: query);

  Map<String, String> get authHeaders => {if (_token != null) 'Authorization': 'Bearer $_token'};

  Future<dynamic> _send(String method, String path, {Object? body, Map<String, String>? query}) async {
    final req = http.Request(method, uri(path, query))
      ..headers.addAll({'Content-Type': 'application/json', 'Accept': 'application/json', ...authHeaders});
    if (body != null) req.body = jsonEncode(body);
    http.Response res;
    try {
      res = await http.Response.fromStream(await _http.send(req).timeout(const Duration(seconds: 30)));
    } on TimeoutException {
      throw const ApiException(0, 'The server took too long to respond.');
    } catch (_) {
      throw ApiException(0, 'Cannot reach the server at $_baseUrl. Check the server address in Settings.');
    }
    final decoded = res.body.isEmpty ? null : jsonDecode(res.body);
    if (res.statusCode >= 400) {
      final msg = decoded is Map && decoded['error'] is Map ? (decoded['error']['message'] as String? ?? 'Request failed') : 'Request failed';
      if (res.statusCode == 401 && _token != null && path != '/auth/login') await logout();
      throw ApiException(res.statusCode, msg);
    }
    return decoded;
  }

  Future<dynamic> get(String path, [Map<String, String>? query]) => _send('GET', path, query: query);
  Future<dynamic> post(String path, [Object? body]) => _send('POST', path, body: body ?? const {});
  Future<dynamic> put(String path, Object body) => _send('PUT', path, body: body);
  Future<dynamic> delete(String path, [Object? body]) => _send('DELETE', path, body: body);

  // ------------------------------------------------------------------ auth

  Future<void> login(String email, String password) async =>
      _saveSession(await post('/auth/login', {'email': email, 'password': password}) as Map<String, dynamic>);

  Future<void> register(String email, String password, String displayName) async => _saveSession(
      await post('/auth/register', {'email': email, 'password': password, if (displayName.isNotEmpty) 'displayName': displayName})
          as Map<String, dynamic>);

  Future<Map<String, dynamic>> health() async => await get('/health') as Map<String, dynamic>;

  // ------------------------------------------------------------------ trips

  Future<TripPlan> planTrip({
    required Place origin,
    required Place destination,
    DateTime? targetArrival,
    DateTime? departAt,
    bool save = true,
  }) async {
    final body = await post('/trips/plan', {
      'origin': origin.toJson(),
      'destination': destination.toJson(),
      if (targetArrival != null) 'targetArrival': isoUtc(targetArrival),
      if (departAt != null) 'departAt': isoUtc(departAt),
      'save': save,
    });
    return TripPlan.fromJson(body as Map<String, dynamic>);
  }

  Future<List<TripSummary>> listTrips({int limit = 10}) async {
    final body = await get('/trips', {'limit': '$limit'}) as Map<String, dynamic>;
    return (body['trips'] as List).map((e) => TripSummary.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> startTrip(String id, RouteType type) => post('/trips/$id/start', {'routeType': type.apiName});
  Future<void> completeTrip(String id) => post('/trips/$id/complete');
  Future<void> cancelTrip(String id) => post('/trips/$id/cancel');

  // ------------------------------------------------------------------ places, traffic, parking

  Future<List<Place>> searchPlaces(String q, {double? lat, double? lng}) async {
    final body = await get('/places/search', {'q': q, if (lat != null) 'lat': '$lat', if (lng != null) 'lng': '$lng'}) as Map<String, dynamic>;
    return (body['results'] as List).map((e) => Place.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<Place> reverseGeocode(double lat, double lng) async {
    final body = await get('/places/reverse', {'lat': '$lat', 'lng': '$lng'}) as Map<String, dynamic>;
    return Place.fromJson(body['place'] as Map<String, dynamic>);
  }

  Future<({int? limitKmh, String? roadName})> speedLimit(double lat, double lng, {String? road}) async {
    final body = await get('/traffic/speed-limit', {'lat': '$lat', 'lng': '$lng', if (road != null && road.isNotEmpty) 'road': road})
        as Map<String, dynamic>;
    return (limitKmh: (body['speedLimitKmh'] as num?)?.toInt(), roadName: body['roadName'] as String?);
  }

  Future<bool> reportSpeed({required double lat, required double lng, required double speedKmh, int? speedLimitKmh, double? heading}) async {
    final body = await post('/traffic/report', {
      'lat': lat,
      'lng': lng,
      'speedKmh': speedKmh.clamp(0, 300),
      'speedLimitKmh': ?speedLimitKmh,
      if (heading != null && heading >= 0 && heading <= 360) 'heading': heading,
    }) as Map<String, dynamic>;
    return body['speeding'] as bool? ?? false;
  }

  Future<Map<String, dynamic>> parkingNear(double lat, double lng) async =>
      await get('/parking/nearby', {'lat': '$lat', 'lng': '$lng'}) as Map<String, dynamic>;

  // ------------------------------------------------------------------ driver profile & commutes

  Future<DriverProfile> getDriverProfile() async =>
      DriverProfile.fromJson((await get('/driver-profile') as Map<String, dynamic>)['profile'] as Map<String, dynamic>);

  Future<DriverProfile> updateDriverProfile(DriverProfile p) async =>
      DriverProfile.fromJson((await put('/driver-profile', p.toJson()) as Map<String, dynamic>)['profile'] as Map<String, dynamic>);

  Future<List<CommuteProfile>> listCommutes() async {
    final body = await get('/driver-profile/commutes') as Map<String, dynamic>;
    return (body['commutes'] as List).map((e) => CommuteProfile.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<CommuteProfile> saveCommute(CommuteProfile c) async {
    final body = c.id == null ? await post('/driver-profile/commutes', c.toJson()) : await put('/driver-profile/commutes/${c.id}', c.toJson());
    return CommuteProfile.fromJson((body as Map<String, dynamic>)['commute'] as Map<String, dynamic>);
  }

  Future<void> deleteCommute(String id) => delete('/driver-profile/commutes/$id');

  Future<Map<String, dynamic>> checkCommute(String id) async =>
      (await post('/driver-profile/commutes/$id/check') as Map<String, dynamic>)['result'] as Map<String, dynamic>;

  Future<Map<String, dynamic>> fatigueCheck({
    required double continuousDriveMinutes,
    required double steeringVariance,
    required int harshEventCount,
    required double speedVariance,
  }) async =>
      await post('/driver-profile/fatigue-check', {
        'continuousDriveMinutes': continuousDriveMinutes,
        'steeringVariance': steeringVariance.clamp(0, 10),
        'harshEventCount': harshEventCount,
        'speedVariance': speedVariance.clamp(0, 10000),
      }) as Map<String, dynamic>;

  // ------------------------------------------------------------------ notifications

  Future<({NotificationPreference prefs, bool pushConfigured})> getNotificationPreferences() async {
    final body = await get('/notifications/preferences') as Map<String, dynamic>;
    return (
      prefs: NotificationPreference.fromJson(body['preferences'] as Map<String, dynamic>),
      pushConfigured: body['pushConfigured'] as bool? ?? false,
    );
  }

  Future<NotificationPreference> updateNotificationPreferences(NotificationPreference p) async => NotificationPreference.fromJson(
      (await put('/notifications/preferences', p.toJson()) as Map<String, dynamic>)['preferences'] as Map<String, dynamic>);

  Future<List<AppNotification>> listNotifications({bool unreadOnly = false}) async {
    final body = await get('/notifications', {if (unreadOnly) 'unread': 'true', 'limit': '50'}) as Map<String, dynamic>;
    return (body['notifications'] as List).map((e) => AppNotification.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> markAllNotificationsRead() => post('/notifications/read-all');

  Future<void> registerDevice(String token, String platform) => post('/notifications/devices', {'token': token, 'platform': platform});

  /// Opens the Server-Sent Events stream; caller must close the returned client.
  Future<(http.Client, http.StreamedResponse)> openNotificationStream() async {
    final client = http.Client();
    final req = http.Request('GET', uri('/notifications/stream'))..headers.addAll({'Accept': 'text/event-stream', ...authHeaders});
    final res = await client.send(req);
    if (res.statusCode != 200) {
      client.close();
      throw ApiException(res.statusCode, 'Notification stream unavailable');
    }
    return (client, res);
  }

  // ------------------------------------------------------------------ assistant & privacy

  Future<String> askAssistant(String message, {double? lat, double? lng, List<Map<String, String>> history = const []}) async {
    final body = await post('/assistant/chat', {
      'message': message,
      if (lat != null && lng != null) 'location': {'lat': lat, 'lng': lng},
      if (history.isNotEmpty) 'history': history,
    }) as Map<String, dynamic>;
    return body['reply'] as String;
  }

  Future<Map<String, dynamic>> exportData() async => await get('/privacy/export') as Map<String, dynamic>;

  Future<void> deleteAccount() async {
    await delete('/privacy/account', {'confirm': 'DELETE'});
    await logout();
  }
}
