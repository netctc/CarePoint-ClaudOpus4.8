import 'dart:convert';

import '../../../core/network/api_client.dart';
import '../../../core/storage/json_cache_store.dart';

class ProviderApiService {
  ProviderApiService({required this.client, required this.cacheStore});

  final ApiClient client;
  final JsonCacheStore cacheStore;

  Future<Map<String, dynamic>> startPrivilegedChallenge({
    required String email,
    required String password,
    required bool managedDevice,
    required bool riskAcknowledged,
    required String channel,
  }) {
    return client.postJson('/api/auth/challenge/start', <String, dynamic>{
      'email': email,
      'password': password,
      'managedDevice': managedDevice,
      'riskAcknowledged': riskAcknowledged,
      'channel': channel,
    });
  }

  Future<Map<String, dynamic>> verifyPrivilegedChallenge({required String challengeId, required String code}) {
    return client.postJson('/api/auth/challenge/verify', <String, dynamic>{
      'challengeId': challengeId,
      'code': code,
    });
  }

  Future<Map<String, dynamic>> resendPrivilegedChallenge(String challengeId) {
    return client.postJson('/api/auth/challenge/resend', <String, dynamic>{'challengeId': challengeId});
  }

  Future<Map<String, dynamic>> dashboard() => _cachedGet('provider.dashboard', '/api/dashboard/provider');
  Future<Map<String, dynamic>> appointments() => _cachedGet('provider.appointments', '/api/appointments');
  Future<Map<String, dynamic>> appointment(String id) => _cachedGet('provider.appointment.$id', '/api/appointments/$id');
  Future<Map<String, dynamic>> confirmAppointment(String id) => client.postJson('/api/appointments/$id/confirm', <String, dynamic>{});
  Future<Map<String, dynamic>> cancelAppointment(String id) => client.postJson('/api/appointments/$id/cancel', <String, dynamic>{});

  Future<Map<String, dynamic>> calendarOverview() => _cachedGet('provider.calendar.overview', '/api/provider/calendar/overview');

  Future<Map<String, dynamic>> calendarAvailability({int days = 14, String? service, String? location}) {
    final String path = _pathWithQuery(
      '/api/provider/calendar/availability',
      <String, String?>{
        'days': '$days',
        'service': service,
        'location': location,
      },
    );
    return _cachedGet('provider.calendar.availability.$days.$service.$location', path);
  }

  Future<Map<String, dynamic>> calendarPublishedSlots({int days = 14}) {
    final String path = _pathWithQuery('/api/provider/calendar/published-slots', <String, String?>{'days': '$days'});
    return _cachedGet('provider.calendar.published.$days', path);
  }

  Future<Map<String, dynamic>> createPublishedSlot(Map<String, dynamic> payload) => client.postJson('/api/provider/calendar/published-slots', payload);
  Future<Map<String, dynamic>> updatePublishedSlot(String slotId, Map<String, dynamic> payload) => client.patchJson('/api/provider/calendar/published-slots/$slotId', payload);
  Future<Map<String, dynamic>> cancelPublishedSlot(String slotId, {String? note}) => client.postJson('/api/provider/calendar/published-slots/$slotId/cancel', <String, dynamic>{'note': note ?? ''});

  Future<Map<String, dynamic>> calendarTemplates({String? status, String? query, String? location}) {
    final String path = _pathWithQuery(
      '/api/provider/calendar/templates',
      <String, String?>{
        'status': status,
        'location': location,
        'q': query,
      },
    );
    return _cachedGet('provider.calendar.templates.$status.$query', path);
  }

  Future<Map<String, dynamic>> calendarTemplateDetail(String templateId) => _cachedGet('provider.calendar.template.$templateId', '/api/provider/calendar/templates/$templateId');
  Future<Map<String, dynamic>> createCalendarTemplate(Map<String, dynamic> payload) => client.postJson('/api/provider/calendar/templates', payload);
  Future<Map<String, dynamic>> updateCalendarTemplate(String templateId, Map<String, dynamic> payload) => client.putJson('/api/provider/calendar/templates/$templateId', payload);
  Future<Map<String, dynamic>> publishCalendarTemplate(String templateId, {String? note}) => client.postJson('/api/provider/calendar/templates/$templateId/publish', <String, dynamic>{'note': note ?? ''});

  Future<Map<String, dynamic>> threads() => _cachedGet('provider.threads', '/api/messaging/threads');
  Future<Map<String, dynamic>> thread(String id) => _cachedGet('provider.thread.$id', '/api/messaging/threads/$id');
  Future<Map<String, dynamic>> sendMessage(String threadId, String body) => client.postJson('/api/messaging/messages', <String, dynamic>{
        'threadId': threadId,
        'body': body,
        'attachments': <dynamic>[],
      });

  Future<Map<String, dynamic>> alerts({String status = 'OPEN'}) => _cachedGet('provider.alerts.$status', '/api/provider/alerts?status=$status');
  Future<Map<String, dynamic>> acknowledgeAlert(String id, {String? note}) => client.postJson('/api/provider/alerts/$id/acknowledge', <String, dynamic>{'note': note ?? ''});
  Future<Map<String, dynamic>> resolveAlert(String id, {String? note}) => client.postJson('/api/provider/alerts/$id/resolve', <String, dynamic>{'note': note ?? ''});

  Future<Map<String, dynamic>> telehealthSessions() => _cachedGet('provider.telehealth.sessions', '/api/telehealth/sessions');
  Future<Map<String, dynamic>> joinTelehealthSession(String id) => client.postJson('/api/telehealth/sessions/$id/join', <String, dynamic>{});
  Future<Map<String, dynamic>> startTelehealthSession(String id) => client.postJson('/api/telehealth/sessions/$id/start', <String, dynamic>{});
  Future<Map<String, dynamic>> endTelehealthSession(String id) => client.postJson('/api/telehealth/sessions/$id/end', <String, dynamic>{});

  Future<Map<String, dynamic>> records({String? patientId, String? subjectProfileId, String? location}) {
    final String path = _pathWithQuery(
      '/api/records',
      <String, String?>{
        'patientId': patientId,
        'subjectProfileId': subjectProfileId,
        'location': location,
      },
    );
    return _cachedGet('provider.records.$patientId.$subjectProfileId', path);
  }

  Future<Map<String, dynamic>> recordDetail(String id) => _cachedGet('provider.records.item.$id', '/api/records/$id');

  Future<Map<String, dynamic>> chartAccessContext({required String patientId, String? subjectProfileId, String? location}) {
    final String path = _pathWithQuery(
      '/api/records/access-context',
      <String, String?>{
        'patientId': patientId,
        'subjectProfileId': subjectProfileId,
        'location': location,
      },
    );
    return _cachedGet('provider.chart.access.$patientId.$subjectProfileId', path);
  }

  Future<Map<String, dynamic>> validateEncounterNote(Map<String, dynamic> payload) => client.postJson('/api/records/encounters/validate', payload);
  Future<Map<String, dynamic>> signEncounterNote(Map<String, dynamic> payload) => client.postJson('/api/records/encounters/sign', payload);

  Future<Map<String, dynamic>> orderSummary({String? location}) => _cachedGet('provider.orders.summary.$location', _pathWithQuery('/api/provider/orders/summary', <String, String?>{'location': location}));
  Future<Map<String, dynamic>> orders({String? patientId, String? subjectProfileId, String? status, String? location}) {
    final String path = _pathWithQuery(
      '/api/provider/orders/items',
      <String, String?>{
        'patientId': patientId,
        'subjectProfileId': subjectProfileId,
        'status': status,
        'location': location,
      },
    );
    return _cachedGet('provider.orders.items.$patientId.$subjectProfileId.$status.$location', path);
  }

  Future<Map<String, dynamic>> orderComposerContext({String? patientId, String? encounterId, String? appointmentId}) {
    final String path = _pathWithQuery(
      '/api/provider/orders/composer-context',
      <String, String?>{
        'patientId': patientId,
        'encounterId': encounterId,
        'appointmentId': appointmentId,
      },
    );
    return _cachedGet('provider.orders.composer.$patientId.$encounterId.$appointmentId', path);
  }

  Future<Map<String, dynamic>> orderDetail(String id) => _cachedGet('provider.orders.item.$id', '/api/provider/orders/items/$id');
  Future<Map<String, dynamic>> createOrderDraft(Map<String, dynamic> payload) => client.postJson('/api/provider/orders/items', payload);
  Future<Map<String, dynamic>> submitOrder(String id, {String? note}) => client.postJson('/api/provider/orders/items/$id/submit', <String, dynamic>{'note': note ?? ''});

  Future<Map<String, dynamic>> prescriptionSummary({String? location}) => _cachedGet('provider.prescriptions.summary.$location', _pathWithQuery('/api/provider/prescriptions/summary', <String, String?>{'location': location}));
  Future<Map<String, dynamic>> prescriptions({String? patientId, String? subjectProfileId, String? location}) {
    final String path = _pathWithQuery(
      '/api/provider/prescriptions/items',
      <String, String?>{
        'patientId': patientId,
        'subjectProfileId': subjectProfileId,
        'location': location,
      },
    );
    return _cachedGet('provider.prescriptions.items.$patientId.$subjectProfileId.$location', path);
  }

  Future<Map<String, dynamic>> prescriptionDetail(String id) => _cachedGet('provider.prescriptions.item.$id', '/api/provider/prescriptions/items/$id');
  Future<Map<String, dynamic>> compliancePreview({required String drug, String? pharmacyName}) {
    final String path = _pathWithQuery('/api/provider/prescriptions/compliance-preview', <String, String?>{
      'drug': drug,
      'pharmacyName': pharmacyName,
    });
    return _cachedGet('provider.prescriptions.preview.${base64Url.encode(utf8.encode('$drug|$pharmacyName'))}', path);
  }

  Future<Map<String, dynamic>> createPrescriptionDraft(Map<String, dynamic> payload) => client.postJson('/api/provider/prescriptions/items', payload);
  Future<Map<String, dynamic>> signPrescription(String id, {String? note}) => client.postJson('/api/provider/prescriptions/items/$id/sign', <String, dynamic>{'note': note ?? ''});
  Future<Map<String, dynamic>> refillRequests({String? patientId, String? status, String? assignedRole, String? queue, bool? controlledOnly, String? location}) {
    final String path = _pathWithQuery(
      '/api/provider/prescriptions/refill-requests',
      <String, String?>{
        'patientId': patientId,
        'status': status,
        'assignedRole': assignedRole,
        'queue': queue,
        'controlledOnly': controlledOnly == null ? null : '$controlledOnly',
        'location': location,
      },
    );
    return _cachedGet('provider.prescriptions.refills.$patientId.$status.$assignedRole.$queue.$controlledOnly.$location', path);
  }

  Future<Map<String, dynamic>> refillRequestHistory(String requestId) => _cachedGet('provider.prescriptions.refills.history.$requestId', '/api/provider/prescriptions/refill-requests/$requestId/history');
  Future<Map<String, dynamic>> refillQueueOptions() => _cachedGet('provider.prescriptions.refills.options', '/api/provider/prescriptions/refill-queue-options');
  Future<Map<String, dynamic>> assignRefillRequest(String requestId, Map<String, dynamic> payload) => client.postJson('/api/provider/prescriptions/refill-requests/$requestId/assign', payload);
  Future<Map<String, dynamic>> escalateRefillRequest(String requestId, Map<String, dynamic> payload) => client.postJson('/api/provider/prescriptions/refill-requests/$requestId/escalate', payload);
  Future<Map<String, dynamic>> reviewRefillRequest(String requestId, Map<String, dynamic> payload) => client.postJson('/api/provider/prescriptions/refill-requests/$requestId/review', payload);

  Future<Map<String, dynamic>> labsSummary() => _cachedGet('provider.labs.summary', '/api/provider/labs/summary');
  Future<Map<String, dynamic>> verifyLabResult(String id, {String? note}) => client.postJson('/api/provider/labs/results/$id/verify', <String, dynamic>{'note': note ?? ''});
  Future<Map<String, dynamic>> secondReviewLabResult(String id, {String? note}) => client.postJson('/api/provider/labs/results/$id/second-review', <String, dynamic>{'note': note ?? ''});
  Future<Map<String, dynamic>> releaseLabResult(String id, {String? note}) => client.postJson('/api/provider/labs/results/$id/release', <String, dynamic>{'note': note ?? ''});
  Future<Map<String, dynamic>> labsInbox() => _cachedGet('provider.labs.inbox', '/api/provider/labs/inbox');
  Future<Map<String, dynamic>> labResult(String id) => _cachedGet('provider.labs.result.$id', '/api/provider/labs/results/$id');

  Future<Map<String, dynamic>> rpmSummary({String? location}) => _cachedGet('provider.rpm.summary.$location', _pathWithQuery('/api/provider/rpm/summary', <String, String?>{'location': location}));
  Future<Map<String, dynamic>> rpmPatients({String? location}) => _cachedGet('provider.rpm.patients.$location', _pathWithQuery('/api/provider/rpm/patients', <String, String?>{'location': location}));
  Future<Map<String, dynamic>> rpmPatient(String id) => _cachedGet('provider.rpm.patient.$id', '/api/provider/rpm/patients/$id');

  Future<Map<String, dynamic>> analyticsOverview({String? location}) => _cachedGet('provider.analytics.overview.$location', _pathWithQuery('/api/provider/analytics/overview', <String, String?>{'location': location}));
  Future<Map<String, dynamic>> teamSummary() => _cachedGet('provider.team.summary', '/api/provider/team/summary');
  Future<Map<String, dynamic>> teamMembers() => _cachedGet('provider.team.members', '/api/provider/team/members');
  Future<Map<String, dynamic>> chartAccessExceptions({String? patientId, String status = 'ACTIVE', String? location}) {
    final String path = _pathWithQuery(
      '/api/provider/team/chart-access-exceptions',
      <String, String?>{
        'patientId': patientId,
        'status': status,
        'location': location,
      },
    );
    return _cachedGet('provider.team.chart-access.$patientId.$status', path);
  }

  Future<Map<String, dynamic>> createChartAccessException({
    required String patientId,
    required String reasonCode,
    String? note,
    String? expiresAt,
  }) {
    return client.postJson('/api/provider/team/chart-access-exceptions', <String, dynamic>{
      'patientId': patientId,
      'reasonCode': reasonCode,
      if ((note ?? '').trim().isNotEmpty) 'note': note!.trim(),
      if ((expiresAt ?? '').trim().isNotEmpty) 'expiresAt': expiresAt!.trim(),
    });
  }

  Future<Map<String, dynamic>> revokeChartAccessException(String exceptionId, {String? note}) {
    return client.postJson('/api/provider/team/chart-access-exceptions/$exceptionId/revoke', <String, dynamic>{
      'note': note ?? '',
    });
  }


  Future<Map<String, dynamic>> onboardingMe() => _cachedGet('provider.onboarding.me', '/api/provider/onboarding/me');
  Future<Map<String, dynamic>> saveOnboardingDraft(Map<String, dynamic> payload) => client.postJson('/api/provider/onboarding/me/save-draft', payload);
  Future<Map<String, dynamic>> submitOnboarding(Map<String, dynamic> payload) => client.postJson('/api/provider/onboarding/me/submit', payload);

  Future<Map<String, dynamic>> hspAccessSummary() => _cachedGet('provider.hsp.access.me', '/api/access/hsp/me');
  Future<Map<String, dynamic>> hspConsentGrants({String status = 'ALL'}) => _cachedGet('provider.hsp.grants.$status', '/api/access/hsp/consent-grants?status=$status');
  Future<Map<String, dynamic>> settingsSummary() => _cachedGet('provider.settings.summary', '/api/provider/settings/summary');
  Future<Map<String, dynamic>> settingsFacilities() => _cachedGet('provider.settings.facilities', '/api/provider/settings/facilities');
  Future<Map<String, dynamic>> settingsFacilityDetail(String facilityId) => _cachedGet('provider.settings.facility.$facilityId', '/api/provider/settings/facilities/$facilityId');
  Future<Map<String, dynamic>> updateFacility(String facilityId, Map<String, dynamic> payload) => client.putJson('/api/provider/settings/facilities/$facilityId', payload);

  String _pathWithQuery(String path, Map<String, String?> queryParameters) {
    final Map<String, String> cleaned = <String, String>{};
    for (final MapEntry<String, String?> entry in queryParameters.entries) {
      final String? value = entry.value?.trim();
      if (value != null && value.isNotEmpty) {
        cleaned[entry.key] = value;
      }
    }
    if (cleaned.isEmpty) {
      return path;
    }
    return Uri(path: path, queryParameters: cleaned).toString();
  }

  Future<Map<String, dynamic>> _cachedGet(String cacheKey, String path) async {
    try {
      final Map<String, dynamic> response = await client.getJson(path);
      await cacheStore.write(cacheKey, response);
      return response;
    } catch (error) {
      final Map<String, dynamic>? cached = cacheStore.read(cacheKey);
      if (cached != null) {
        return cached;
      }
      rethrow;
    }
  }
}
