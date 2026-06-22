import 'json_utils.dart';

String buildAppRoute(String path, {Map<String, String?> queryParameters = const <String, String?>{}}) {
  final Map<String, String> cleaned = <String, String>{};
  for (final MapEntry<String, String?> entry in queryParameters.entries) {
    final String? value = entry.value?.trim();
    if (value != null && value.isNotEmpty && value != '—') {
      cleaned[entry.key] = value;
    }
  }
  if (cleaned.isEmpty) {
    return path;
  }
  return Uri(path: path, queryParameters: cleaned).toString();
}

Map<String, String?> buildClinicalContextFromSource(dynamic source) {
  final Map<String, dynamic> item = asMap(source);
  return <String, String?>{
    'patientId': _readOptional(item, const <String>['patientId']),
    'appointmentId': _readOptional(item, const <String>['appointmentId', 'id']),
    'patientName': _readOptional(item, const <String>['patientName', 'subjectLabel']),
    'subjectProfileId': _readOptional(item, const <String>['subjectProfileId']),
    'subjectLabel': _readOptional(item, const <String>['subjectLabel']),
    'subjectRelationship': _readOptional(item, const <String>['subjectRelationship']),
  };
}

String buildChartRoute(dynamic source) {
  final Map<String, String?> context = buildClinicalContextFromSource(source);
  final String? patientId = context['patientId'];
  if (patientId == null || patientId.isEmpty) {
    return '/records';
  }
  return buildAppRoute(
    '/chart/$patientId',
    queryParameters: <String, String?>{
      'patientName': context['patientName'],
      'subjectProfileId': context['subjectProfileId'],
      'subjectLabel': context['subjectLabel'],
      'subjectRelationship': context['subjectRelationship'],
    },
  );
}

String buildRecordDetailRoute(dynamic source) {
  final String recordId = readString(asMap(source), const <String>['id', 'recordId'], fallback: '').trim();
  if (recordId.isEmpty || recordId == '—') {
    return '/records';
  }
  return '/records/$recordId';
}

String buildEncounterRoute(dynamic source) => buildAppRoute('/encounters/new', queryParameters: buildClinicalContextFromSource(source));

String buildOrderComposerRoute(dynamic source) => buildAppRoute('/orders/new', queryParameters: buildClinicalContextFromSource(source));

String buildPrescriptionComposerRoute(dynamic source) => buildAppRoute('/prescriptions/new', queryParameters: buildClinicalContextFromSource(source));

String buildRpmPatientRoute(String patientId, {String? patientName}) {
  return buildAppRoute('/rpm/$patientId', queryParameters: <String, String?>{'patientName': patientName});
}

String? _readOptional(Map<String, dynamic> source, List<String> keys) {
  final String value = readString(source, keys, fallback: '');
  final String trimmed = value.trim();
  if (trimmed.isEmpty || trimmed == '—') {
    return null;
  }
  return trimmed;
}
