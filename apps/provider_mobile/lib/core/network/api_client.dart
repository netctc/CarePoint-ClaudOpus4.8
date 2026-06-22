import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

class ApiClientException implements Exception {
  ApiClientException({
    required this.method,
    required this.path,
    required this.statusCode,
    required this.message,
  });

  final String method;
  final String path;
  final int statusCode;
  final String message;

  bool get isUnauthorized => statusCode == 401;

  @override
  String toString() => '$method $path failed: $statusCode $message';
}

class ApiClient {
  ApiClient({required this.baseUrl, this.accessToken, this.localeCode = 'en', this.onUnauthorized});

  final String baseUrl;
  String? accessToken;
  String localeCode;
  void Function()? onUnauthorized;

  Uri _uri(String path) {
    final String normalizedBase = baseUrl.endsWith('/') ? baseUrl.substring(0, baseUrl.length - 1) : baseUrl;
    final String normalizedPath = path.startsWith('/') ? path : '/$path';
    return Uri.parse('$normalizedBase$normalizedPath');
  }

  Map<String, String> _headers() => <String, String>{
        'Content-Type': 'application/json',
        'Accept-Language': localeCode,
        if (accessToken != null && accessToken!.isNotEmpty) 'Authorization': 'Bearer $accessToken',
      };

  Future<Map<String, dynamic>> getJson(String path) => _sendJson('GET', path);
  Future<Map<String, dynamic>> postJson(String path, Map<String, dynamic> body) => _sendJson('POST', path, body: body);
  Future<Map<String, dynamic>> putJson(String path, Map<String, dynamic> body) => _sendJson('PUT', path, body: body);
  Future<Map<String, dynamic>> patchJson(String path, Map<String, dynamic> body) => _sendJson('PATCH', path, body: body);

  Future<Map<String, dynamic>> _sendJson(String method, String path, {Map<String, dynamic>? body}) async {
    final Uri uri = _uri(path);
    final Object? encodedBody = body == null ? null : jsonEncode(body);
    late final http.Response response;

    switch (method) {
      case 'GET':
        response = await http.get(uri, headers: _headers()).timeout(const Duration(seconds: 20));
        break;
      case 'POST':
        response = await http.post(uri, headers: _headers(), body: encodedBody).timeout(const Duration(seconds: 20));
        break;
      case 'PUT':
        response = await http.put(uri, headers: _headers(), body: encodedBody).timeout(const Duration(seconds: 20));
        break;
      case 'PATCH':
        response = await http.patch(uri, headers: _headers(), body: encodedBody).timeout(const Duration(seconds: 20));
        break;
      default:
        throw UnsupportedError('Unsupported method: $method');
    }

    return _decodeResponse(method: method, path: path, response: response);
  }

  Map<String, dynamic> _decodeResponse({
    required String method,
    required String path,
    required http.Response response,
  }) {
    final String body = response.body.trim();
    final dynamic decoded = body.isEmpty ? <String, dynamic>{} : jsonDecode(body);

    if (response.statusCode >= 400) {
      String message = body.isEmpty ? 'Request failed.' : body;
      if (decoded is Map<String, dynamic>) {
        final dynamic error = decoded['error'];
        final dynamic details = decoded['message'] ?? decoded['details'];
        if (error is String && error.isNotEmpty) {
          message = error;
        } else if (details is String && details.isNotEmpty) {
          message = details;
        }
      }

      if (response.statusCode == 401) {
        onUnauthorized?.call();
      }

      throw ApiClientException(method: method, path: path, statusCode: response.statusCode, message: message);
    }

    if (decoded is Map<String, dynamic>) {
      return decoded;
    }
    return <String, dynamic>{'data': decoded};
  }
}
