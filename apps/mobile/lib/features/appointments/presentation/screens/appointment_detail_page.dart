import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../core/state/app_session.dart';
import '../../../../core/widgets/patient_ui.dart';

class AppointmentDetailPage extends StatefulWidget {
  const AppointmentDetailPage({super.key, this.appointmentId});

  final String? appointmentId;

  @override
  State<AppointmentDetailPage> createState() => _AppointmentDetailPageState();
}

class _AppointmentDetailPageState extends State<AppointmentDetailPage> {
  late Future<_AppointmentDetailPayload> _future;
  late String _subjectKey;
  bool _updatingConsent = false;
  String? _actionError;

  String get _currentSubjectKey => '${AppSession.instance.activeSubjectId ?? 'self'}|${AppSession.instance.activeSubjectLabel}';

  @override
  void initState() {
    super.initState();
    _subjectKey = _currentSubjectKey;
    AppSession.instance.addListener(_handleSessionChange);
    _future = _load();
  }

  @override
  void dispose() {
    AppSession.instance.removeListener(_handleSessionChange);
    super.dispose();
  }

  void _handleSessionChange() {
    final String nextKey = _currentSubjectKey;
    if (nextKey == _subjectKey) return;
    _subjectKey = nextKey;
    final Future<_AppointmentDetailPayload> refreshed = _load();
    if (mounted) {
      setState(() { _future = refreshed; });
    }
  }

  Future<_AppointmentDetailPayload> _load() async {
    Map<String, dynamic>? appointment;
    if ((widget.appointmentId ?? '').isNotEmpty) {
      appointment = await AppSession.instance.appointmentDetail(widget.appointmentId!);
    } else {
      final List<Map<String, dynamic>> appointments = (((await AppSession.instance.appointments())['items'] as List<dynamic>?) ?? <dynamic>[]).whereType<Map<String, dynamic>>().toList();
      appointment = appointments.isNotEmpty ? appointments.first : null;
    }

    if (appointment == null) {
      return const _AppointmentDetailPayload();
    }

    final String appointmentId = appointment['id']?.toString() ?? '';
    final List<Map<String, dynamic>> sessions = (((await AppSession.instance.telehealthSessions())['items'] as List<dynamic>?) ?? <dynamic>[]).whereType<Map<String, dynamic>>().toList();
    final Map<String, dynamic>? session = appointmentId.isEmpty
        ? null
        : sessions.cast<Map<String, dynamic>?>().firstWhere(
            (Map<String, dynamic>? item) => item?['appointmentId']?.toString() == appointmentId,
            orElse: () => null,
          );
    Map<String, dynamic>? consent;
    if (appointmentId.isNotEmpty) {
      try {
        final Map<String, dynamic> response = await AppSession.instance.appointmentAccessConsent(appointmentId);
        consent = (response['consent'] as Map?)?.cast<String, dynamic>();
      } catch (_) {
        consent = (appointment['providerAccess'] as Map?)?.cast<String, dynamic>();
      }
    }
    return _AppointmentDetailPayload(appointment: appointment, session: session, consent: consent);
  }

  Future<void> _refresh() async {
    _subjectKey = _currentSubjectKey;
    final Future<_AppointmentDetailPayload> refreshed = _load();
    setState(() { _future = refreshed; });
    await refreshed;
  }

  Future<void> _updateConsent({required bool grant}) async {
    final _AppointmentDetailPayload payload = await _future;
    final String appointmentId = payload.appointment?['id']?.toString() ?? '';
    if (appointmentId.isEmpty) return;
    setState(() {
      _updatingConsent = true;
      _actionError = null;
    });
    try {
      if (grant) {
        await AppSession.instance.grantAppointmentAccessConsent(appointmentId);
      } else {
        await AppSession.instance.revokeAppointmentAccessConsent(appointmentId);
      }
      await _refresh();
    } catch (error) {
      setState(() => _actionError = error.toString());
    } finally {
      if (mounted) {
        setState(() => _updatingConsent = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return PatientScaffold(
      title: 'Appointment detail',
      subtitle: 'Visit preparation, logistics, and next steps',
      showBack: true,
      showNavigation: false,
      backgroundGradient: true,
      child: FutureBuilder<_AppointmentDetailPayload>(
        future: _future,
        builder: (BuildContext context, AsyncSnapshot<_AppointmentDetailPayload> snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Padding(
              padding: const EdgeInsets.all(24),
              child: PatientEmptyState(
                title: 'Unable to load appointment',
                body: snapshot.error.toString(),
                icon: Icons.event_busy_outlined,
                action: FilledButton.tonal(onPressed: _refresh, child: const Text('Try again')),
              ),
            );
          }

          final _AppointmentDetailPayload payload = snapshot.data ?? const _AppointmentDetailPayload();
          final Map<String, dynamic>? item = payload.appointment;
          final Map<String, dynamic>? session = payload.session;
          final Map<String, dynamic>? consent = payload.consent;
          if (item == null) {
            return const Padding(
              padding: EdgeInsets.all(24),
              child: PatientEmptyState(title: 'No appointment found', body: 'Book a new visit to see appointment details here.'),
            );
          }
          final DateTime? startsAt = _parseDate(item['startsAt']);
          final DateTime? endsAt = _parseDate(item['endsAt']);
          final String appointmentType = item['appointmentType']?.toString() ?? ((item['location']?.toString().toLowerCase().contains('virtual') ?? false) ? 'ONLINE_MEETING' : 'IN_PERSON_VISIT');
          final bool isTelehealth = session != null || appointmentType == 'ONLINE_MEETING';
          final String appointmentId = item['id']?.toString() ?? '';
          final String sessionId = session?['id']?.toString() ?? '';
          final String status = item['status']?.toString() ?? 'CONFIRMED';
          final String consentStatus = consent?['consentStatus']?.toString() ?? 'PENDING';
          final List<_CheckItem> checkItems = <_CheckItem>[
            _CheckItem('Identity verified', item['patientName'] != null),
            _CheckItem('Doctor access consent', consentStatus == 'GRANTED'),
            _CheckItem('Payment reviewed', item['paymentStatus']?.toString().isNotEmpty ?? false),
            _CheckItem('Pre-visit notes ready', item['intakeStatus']?.toString() == 'COMPLETE'),
          ];
          final int completedChecks = checkItems.where((item) => item.done).length;

          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
              children: <Widget>[
                PatientHeroCard(
                  badge: status,
                  title: item['service']?.toString() ?? 'Consultation',
                  subtitle: '${_formatDateTime(startsAt)} • ${item['providerName'] ?? 'CarePoint clinician'}',
                  child: Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: <Widget>[
                      PatientTag(label: appointmentType == 'ONLINE_MEETING' ? 'Online Meeting' : 'In-Person Visit', icon: appointmentType == 'ONLINE_MEETING' ? Icons.videocam_outlined : Icons.meeting_room_outlined),
                      PatientTag(label: item['location']?.toString() ?? 'CarePoint facility', icon: isTelehealth ? Icons.videocam_outlined : Icons.location_on_outlined),
                      if (endsAt != null) PatientTag(label: '${endsAt.difference(startsAt ?? endsAt).inMinutes} min', icon: Icons.timelapse_outlined),
                    ],
                  ),
                ),
                const SizedBox(height: 18),
                Row(
                  children: <Widget>[
                    Expanded(
                      child: PatientMetricCard(
                        label: 'Readiness',
                        value: '$completedChecks / ${checkItems.length}',
                        caption: 'Preparation items completed',
                        icon: Icons.fact_check_outlined,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: PatientMetricCard(
                        label: 'Access status',
                        value: _consentLabel(consentStatus),
                        caption: 'Provider health-profile access',
                        icon: Icons.verified_user_outlined,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                PatientCard(
                  child: PatientProgressStrip(
                    label: 'Visit preparation progress',
                    progress: checkItems.isEmpty ? 0 : completedChecks / checkItems.length,
                    caption: isTelehealth ? 'Complete setup, confirm doctor access, and join the waiting room when your provider is ready.' : 'Finish the checklist, confirm doctor access if needed, and bring your ID or insurance card to the visit.',
                  ),
                ),
                const SizedBox(height: 18),
                const PatientSectionTitle(title: 'Visit details'),
                const SizedBox(height: 12),
                PatientCard(
                  child: Column(
                    children: <Widget>[
                      PatientInfoRow(label: 'Provider', value: item['providerName']?.toString() ?? 'CarePoint clinician', icon: Icons.person_outline),
                      PatientInfoRow(label: 'Service', value: item['service']?.toString() ?? 'Consultation', icon: Icons.medical_information_outlined),
                      PatientInfoRow(label: 'Appointment type', value: appointmentType == 'ONLINE_MEETING' ? 'Online Meeting' : 'In-Person Visit', icon: appointmentType == 'ONLINE_MEETING' ? Icons.videocam_outlined : Icons.meeting_room_outlined),
                      PatientInfoRow(label: 'Time', value: _formatDateTime(startsAt), icon: Icons.schedule_outlined),
                      PatientInfoRow(label: 'Location', value: item['location']?.toString() ?? 'CarePoint facility', icon: Icons.place_outlined),
                      PatientInfoRow(label: 'Payment status', value: item['paymentStatus']?.toString() ?? 'Ready for confirmation', icon: Icons.credit_card_outlined),
                    ],
                  ),
                ),
                const SizedBox(height: 18),
                const PatientSectionTitle(title: 'Doctor access consent'),
                const SizedBox(height: 12),
                PatientCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text('Give the treating doctor access to the active profile health information for this appointment, or revoke that access at any time.', style: Theme.of(context).textTheme.bodyMedium),
                      const SizedBox(height: 12),
                      PatientInfoRow(label: 'Status', value: _consentLabel(consentStatus), icon: Icons.shield_outlined),
                      if ((consent?['grantedAt']?.toString() ?? '').isNotEmpty) PatientInfoRow(label: 'Granted at', value: _formatDateTime(_parseDate(consent?['grantedAt'])), icon: Icons.event_available_outlined),
                      if ((consent?['revokedAt']?.toString() ?? '').isNotEmpty) PatientInfoRow(label: 'Revoked at', value: _formatDateTime(_parseDate(consent?['revokedAt'])), icon: Icons.event_busy_outlined),
                      if ((_actionError ?? '').isNotEmpty) ...<Widget>[
                        const SizedBox(height: 8),
                        Text(_actionError!, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Theme.of(context).colorScheme.error)),
                      ],
                      const SizedBox(height: 12),
                      Row(
                        children: <Widget>[
                          Expanded(
                            child: FilledButton.icon(
                              onPressed: _updatingConsent || consentStatus == 'GRANTED' ? null : () => _updateConsent(grant: true),
                              icon: _updatingConsent && consentStatus != 'GRANTED' ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.lock_open_outlined),
                              label: const Text('Grant access'),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: _updatingConsent || consentStatus == 'REVOKED' ? null : () => _updateConsent(grant: false),
                              icon: const Icon(Icons.block_outlined),
                              label: const Text('Revoke access'),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),
                const PatientSectionTitle(title: 'Preparation checklist'),
                const SizedBox(height: 12),
                PatientCard(
                  child: Column(
                    children: List<Widget>.generate(checkItems.length, (int index) {
                      final _CheckItem checklistItem = checkItems[index];
                      return CheckboxListTile(
                        value: checklistItem.done,
                        onChanged: null,
                        dense: true,
                        contentPadding: EdgeInsets.zero,
                        title: Text(checklistItem.label),
                        controlAffinity: ListTileControlAffinity.leading,
                      );
                    }),
                  ),
                ),
                const SizedBox(height: 18),
                const PatientSectionTitle(title: 'What happens next'),
                const SizedBox(height: 12),
                PatientCard(
                  child: Column(
                    children: <Widget>[
                      PatientTimelineStep(title: 'Booking confirmed', subtitle: 'Your visit is scheduled and locked in.'),
                      PatientTimelineStep(title: isTelehealth ? 'Join waiting room' : 'Arrive and check in', subtitle: isTelehealth ? 'Test your mic, camera, and network before joining.' : 'Use the QR code or your name to complete arrival.', trailing: PatientStatusBadge(label: status)),
                      PatientTimelineStep(title: 'Consultation', subtitle: 'Meet your provider and review symptoms, treatment, or care plan.'),
                      PatientTimelineStep(title: 'Summary & follow-up', subtitle: 'Get notes, orders, prescriptions, or reminders after the visit.', isLast: true),
                    ],
                  ),
                ),
                const SizedBox(height: 18),
                const PatientSectionTitle(title: 'Quick actions'),
                const SizedBox(height: 12),
                PatientActionTile(
                  title: isTelehealth ? 'Enter waiting room' : 'View post-visit summary',
                  subtitle: isTelehealth ? 'Open audio and camera checks for your remote visit.' : 'See visit details and any clinician instructions.',
                  icon: isTelehealth ? Icons.video_call_outlined : Icons.description_outlined,
                  onTap: () => context.go(isTelehealth ? '/telehealth/waiting?appointmentId=$appointmentId&sessionId=$sessionId' : '/encounter/summary?appointmentId=$appointmentId'),
                ),
                const SizedBox(height: 12),
                PatientActionTile(
                  title: 'Message your care team',
                  subtitle: 'Send a question or update before the appointment.',
                  icon: Icons.chat_bubble_outline,
                  onTap: () => context.go('/messages/inbox'),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _AppointmentDetailPayload {
  const _AppointmentDetailPayload({this.appointment, this.session, this.consent});

  final Map<String, dynamic>? appointment;
  final Map<String, dynamic>? session;
  final Map<String, dynamic>? consent;
}

class _CheckItem {
  const _CheckItem(this.label, this.done);

  final String label;
  final bool done;
}

DateTime? _parseDate(Object? value) {
  final String text = value?.toString() ?? '';
  if (text.isEmpty) return null;
  return DateTime.tryParse(text)?.toLocal();
}

String _formatDateTime(DateTime? value) {
  if (value == null) return 'Schedule pending';
  return DateFormat('EEE, d MMM • h:mm a').format(value);
}

String _consentLabel(String status) {
  switch (status.toUpperCase()) {
    case 'GRANTED':
      return 'Granted';
    case 'REVOKED':
      return 'Revoked';
    default:
      return 'Pending';
  }
}
