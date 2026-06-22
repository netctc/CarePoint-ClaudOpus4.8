import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

class JsonCacheStore {
  JsonCacheStore._(this._preferences);

  final SharedPreferences _preferences;

  static Future<JsonCacheStore> create() async {
    final SharedPreferences preferences = await SharedPreferences.getInstance();
    return JsonCacheStore._(preferences);
  }

  Future<void> write(String key, Map<String, dynamic> value) async {
    await _preferences.setString(key, jsonEncode(value));
  }

  Map<String, dynamic>? read(String key) {
    final String? raw = _preferences.getString(key);
    if (raw == null || raw.trim().isEmpty) {
      return null;
    }
    try {
      return Map<String, dynamic>.from(jsonDecode(raw) as Map);
    } catch (_) {
      return null;
    }
  }

  Future<void> remove(String key) async {
    await _preferences.remove(key);
  }
}
