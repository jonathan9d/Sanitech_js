import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

/// État renvoyé par la route `/status` de l'ESP32.
class SanitechStatus {
  final bool pump;
  final bool doorOpen;
  final int count;

  const SanitechStatus({
    required this.pump,
    required this.doorOpen,
    required this.count,
  });

  factory SanitechStatus.fromJson(Map<String, dynamic> json) {
    return SanitechStatus(
      pump: json['pump'] == true,
      doorOpen: json['doorOpen'] == true,
      count: (json['count'] as num?)?.toInt() ?? 0,
    );
  }

  static const idle = SanitechStatus(pump: false, doorOpen: false, count: 0);
}

/// Client HTTP vers le poste Sanitech. Reproduit exactement les routes
/// exposées par le firmware ESP32 (voir sanitech.ino) :
/// /status, /door, /led/white, /led/red, /led/green, /test, /set, /rgb.
class SanitechApi {
  static const _prefsKeyIp = 'sanitech_device_ip';
  static const defaultIp = '192.168.4.2';

  String _ip = defaultIp;
  String get ip => _ip;

  Uri _uri(String path) => Uri.parse('http://$_ip$path');

  Future<void> loadSavedIp() async {
    final prefs = await SharedPreferences.getInstance();
    _ip = prefs.getString(_prefsKeyIp) ?? defaultIp;
  }

  Future<void> saveIp(String ip) async {
    _ip = ip.trim().isEmpty ? defaultIp : ip.trim();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefsKeyIp, _ip);
  }

  /// Utilisé pendant l'onboarding pour vérifier qu'un appareil répond
  /// bien à l'adresse saisie, avant de valider la configuration.
  Future<bool> testConnection(String ip) async {
    try {
      final uri = Uri.parse('http://${ip.trim()}/status');
      final res = await http.get(uri).timeout(const Duration(seconds: 4));
      return res.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  Future<SanitechStatus> getStatus() async {
    final res = await http.get(_uri('/status')).timeout(const Duration(seconds: 4));
    if (res.statusCode != 200) throw Exception('Statut HTTP ${res.statusCode}');
    return SanitechStatus.fromJson(jsonDecode(res.body) as Map<String, dynamic>);
  }

  Future<void> doorAction(String action) => _fire('/door?action=$action');

  Future<void> setWhiteLed(bool on) => _fire('/led/white?state=${on ? 'on' : 'off'}');

  Future<void> toggleRedLed() => _fire('/led/red?state=toggle');

  Future<void> toggleGreenLed() => _fire('/led/green?state=toggle');

  Future<void> triggerTestSpray() => _fire('/test');

  Future<void> setSprayDurationMs(int ms) => _fire('/set?spray=$ms');

  Future<void> setRgbMode(String mode) => _fire('/rgb?mode=$mode');

  Future<void> setRgbColor(int r, int g, int b) => _fire('/rgb?r=$r&g=$g&b=$b');

  Future<void> _fire(String path) async {
    await http.get(_uri(path)).timeout(const Duration(seconds: 4));
  }
}
