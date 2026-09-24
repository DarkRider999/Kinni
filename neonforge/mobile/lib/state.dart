import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api/client.dart';
import 'api/models.dart';

/// App-wide session: auth token, current user and the live event stream.
class Session extends ChangeNotifier {
  Session(this.api, {this.liveEvents = true});

  final ApiClient api;

  /// Tests turn the WebSocket off and rely on the polling fallback in [watchJob].
  final bool liveEvents;
  Me? me;
  bool ready = false;
  final _events = StreamController<ServerEvent>.broadcast();
  StreamSubscription<ServerEvent>? _sub;
  Timer? _reconnect;
  int _retry = 0;

  Stream<ServerEvent> get events => _events.stream;

  Future<void> restore() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      api.token = prefs.getString('nf.token');
      if (api.token != null) {
        me = await api.me();
        _connect();
      }
    } catch (_) {
      api.token = null;
      me = null;
    }
    ready = true;
    notifyListeners();
  }

  Future<void> login(String email, String plan) async {
    final (token, user) = await api.devLogin(email, plan);
    api.token = token;
    me = user;
    (await SharedPreferences.getInstance()).setString('nf.token', token);
    _connect();
    notifyListeners();
  }

  Future<void> logout() async {
    api.token = null;
    me = null;
    await _sub?.cancel();
    (await SharedPreferences.getInstance()).remove('nf.token');
    notifyListeners();
  }

  Future<void> refreshMe() async {
    try {
      me = await api.me();
      notifyListeners();
    } catch (_) {}
  }

  void _connect() {
    if (!liveEvents) return;
    _sub?.cancel();
    try {
      _sub = api.events().listen((ev) {
        _retry = 0;
        _events.add(ev);
        if (ev.type == 'job.progress' && ev.data['kind'] == 'render' && const {'succeeded', 'failed', 'cancelled'}.contains(ev.status)) {
          refreshMe();
        }
      }, onError: (_) => _scheduleReconnect(), onDone: _scheduleReconnect, cancelOnError: true);
    } catch (_) {
      _scheduleReconnect();
    }
  }

  void _scheduleReconnect() {
    if (me == null) return;
    _reconnect?.cancel();
    final delay = Duration(milliseconds: (500 * (1 << _retry.clamp(0, 5))));
    _retry++;
    _reconnect = Timer(delay, _connect);
  }

  /// Follow one job to completion: live events with a polling safety net.
  Future<Job> watchJob(String jobId, void Function(String status, double progress, String? stage) onUpdate) async {
    final done = Completer<void>();
    void handle(String status, double progress, String? stage) {
      if (done.isCompleted) return;
      onUpdate(status, progress, stage);
      if (const {'succeeded', 'failed', 'cancelled'}.contains(status)) done.complete();
    }

    final sub = events.where((e) => e.jobId == jobId).listen((e) => handle(e.status, e.progress, e.stage));
    final poll = Timer.periodic(const Duration(milliseconds: 2500), (_) async {
      try {
        final j = await api.job(jobId);
        handle(j.status, j.progress, j.stage);
      } catch (_) {}
    });
    try {
      final first = await api.job(jobId);
      handle(first.status, first.progress, first.stage);
      await done.future;
    } finally {
      await sub.cancel();
      poll.cancel();
    }
    return api.job(jobId);
  }

  @override
  void dispose() {
    _sub?.cancel();
    _reconnect?.cancel();
    _events.close();
    super.dispose();
  }
}

/// Minimal InheritedNotifier so screens can `Session.of(context)` without extra packages.
class SessionScope extends InheritedNotifier<Session> {
  const SessionScope({super.key, required Session session, required super.child}) : super(notifier: session);

  static Session of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<SessionScope>()!.notifier!;
}
