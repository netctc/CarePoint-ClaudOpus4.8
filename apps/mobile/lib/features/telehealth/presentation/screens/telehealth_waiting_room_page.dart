import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../core/state/app_session.dart';
import '../../../../core/widgets/patient_ui.dart';

class TelehealthWaitingRoomPage extends StatefulWidget {
  const TelehealthWaitingRoomPage({super.key, this.appointmentId, this.sessionId});

  final String? appointmentId;
  final String? sessionId;

  @override
  State<TelehealthWaitingRoomPage> createState() => _TelehealthWaitingRoomPageState();
}

class _TelehealthWaitingRoomPageState extends State<TelehealthWaitingRoomPage> {
  late Future<_WaitingRoomPayload> _future;
  bool _micReady = true;
  bool _cameraReady = true;
  bool _networkReady = true;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_WaitingRoomPayload> _load() async {
    final List<Map<String, dynamic>> sessions = (((await AppSession.instance.telehealthSessions())['items'] as List<dynamic>?) ?? <dynamic>[]).whereType<Map<String, dynamic>>().toList();
    final List<Map<String, dynamic>> appointments = (((await AppSession.instance.appointments())['items'] as List<dynamic>?) ?? <dynamic>[]).whereType<Map<String, dynamic>>().toList();

    Map<String, dynamic>? session;
    if ((widget.sessionId ?? '').isNotEmpty) {
      session = sessions.cast<Map<String, dynamic>?>().firstWhere((Map<String, dynamic>? item) => item?['id']?.toString() == widget.sessionId, orElse: () => null);
    }
    session ??= sessions.cast<Map<String, dynamic>?>().firstWhere((Map<String, dynamic>? item) => item?['appointmentId']?.toString() == widget.appointmentId, orElse: () => null);
    session ??= sessions.isNotEmpty ? sessions.first : null;

    final String? appointmentId = widget.appointmentId ?? session?['appointmentId']?.toString();
    Map<String, dynamic>? appointment;
    if ((appointmentId ?? '').isNotEmpty) {
      appointment = appointments.cast<Map<String, dynamic>?>().firstWhere((Map<String, dynamic>? item) => item?['id']?.toString() == appointmentId, orElse: () => null);
    }
    appointment ??= appointments.cast<Map<String, dynamic>?>().firstWhere(
          (Map<String, dynamic>? item) => (item?['location']?.toString().toLowerCase().contains('virtual') ?? false),
          orElse: () => null,
        );

    return _WaitingRoomPayload(appointment: appointment, session: session);
  }

  Future<void> _refresh() async {
    final Future<_WaitingRoomPayload> refreshed = _load();
    setState(() { _future = refreshed; });
    await refreshed;
  }

  @override
  Widget build(BuildContext context) {
    return PatientScaffold(
      title: 'Waiting room',
      subtitle: 'Telehealth readiness and session controls',
      showBack: true,
      showNavigation: false,
      backgroundGradient: true,
      child: FutureBuilder<_WaitingRoomPayload>(
        future: _future,
        builder: (BuildContext context, AsyncSnapshot<_WaitingRoomPayload> snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Padding(
              padding: const EdgeInsets.all(24),
              child: PatientEmptyState(
                title: 'Unable to enter waiting room',
                body: snapshot.error.toString(),
                icon: Icons.wifi_off_rounded,
                action: FilledButton.tonal(onPressed: _refresh, child: const Text('Retry')),
              ),
            );
          }

          final _WaitingRoomPayload payload = snapshot.data ?? const _WaitingRoomPayload();
          final Map<String, dynamic>? appointment = payload.appointment;
          final Map<String, dynamic>? session = payload.session;
          final String appointmentId = appointment?['id']?.toString() ?? widget.appointmentId ?? '';
          final String sessionId = session?['id']?.toString() ?? widget.sessionId ?? '';
          final DateTime? startsAt = _parseDate(appointment?['startsAt']);
          final String providerName = appointment?['providerName']?.toString() ?? 'CarePoint clinician';
          final int readyCount = <bool>[_micReady, _cameraReady, _networkReady].where((bool item) => item).length;

          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
              children: <Widget>[
                PatientHeroCard(
                  badge: session?['status']?.toString() ?? 'Waiting',
                  title: 'Your provider will join shortly',
                  subtitle: '${appointment?['service'] ?? 'Telehealth visit'} • ${_formatDateTime(startsAt)}',
                  child: Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: <Widget>[
                      PatientTag(label: providerName, icon: Icons.person_outline),
                      PatientTag(label: 'Private connection', icon: Icons.lock_outline),
                    ],
                  ),
                ),
                const SizedBox(height: 18),
                Row(
                  children: <Widget>[
                    Expanded(child: PatientMetricCard(label: 'Tech checks', value: '$readyCount / 3', caption: 'Mic, camera, and network', icon: Icons.health_and_safety_outlined)),
                    const SizedBox(width: 12),
                    Expanded(child: PatientMetricCard(label: 'Session type', value: 'Video', caption: 'Live virtual consultation', icon: Icons.video_camera_front_outlined)),
                  ],
                ),
                const SizedBox(height: 18),
                PatientCard(
                  child: PatientProgressStrip(
                    label: 'Pre-call readiness',
                    progress: readyCount / 3,
                    caption: 'Finish your quick checks so you can join the visit with fewer interruptions.',
                  ),
                ),
                const SizedBox(height: 18),
                const PatientSectionTitle(title: 'Device checks'),
                const SizedBox(height: 12),
                PatientCard(
                  child: Column(
                    children: <Widget>[
                      SwitchListTile.adaptive(
                        contentPadding: EdgeInsets.zero,
                        value: _micReady,
                        onChanged: (bool value) => setState(() => _micReady = value),
                        title: const Text('Microphone ready'),
                        subtitle: const Text('Enable microphone access for the visit.'),
                      ),
                      const Divider(height: 10),
                      SwitchListTile.adaptive(
                        contentPadding: EdgeInsets.zero,
                        value: _cameraReady,
                        onChanged: (bool value) => setState(() => _cameraReady = value),
                        title: const Text('Camera ready'),
                        subtitle: const Text('Turn on the camera or allow camera permission.'),
                      ),
                      const Divider(height: 10),
                      SwitchListTile.adaptive(
                        contentPadding: EdgeInsets.zero,
                        value: _networkReady,
                        onChanged: (bool value) => setState(() => _networkReady = value),
                        title: const Text('Network stable'),
                        subtitle: const Text('Use Wi‑Fi or strong cellular coverage for the best experience.'),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),
                const PatientSectionTitle(title: 'Before you join'),
                const SizedBox(height: 12),
                PatientCard(
                  child: Column(
                    children: <Widget>[
                      PatientTimelineStep(title: 'Check audio & video', subtitle: 'Confirm that your microphone and camera are working.'),
                      PatientTimelineStep(title: 'Keep documents nearby', subtitle: 'Have your insurance card, medication list, and questions ready.'),
                      PatientTimelineStep(title: 'Join when prompted', subtitle: 'Move into the live call once the care team opens the session.', isLast: true),
                    ],
                  ),
                ),
                const SizedBox(height: 18),
                const PatientSectionTitle(title: 'Quick actions'),
                const SizedBox(height: 12),
                PatientActionTile(
                  title: 'Open secure messages',
                  subtitle: 'Send an update before the session starts.',
                  icon: Icons.chat_bubble_outline,
                  onTap: () => context.go('/messages/inbox'),
                ),
                const SizedBox(height: 12),
                PatientActionTile(
                  title: 'Review appointment detail',
                  subtitle: 'Recheck provider, time, and coverage details.',
                  icon: Icons.event_note_outlined,
                  onTap: () => context.go('/appointments/detail?id=$appointmentId'),
                ),
                const SizedBox(height: 18),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: (_micReady && _cameraReady && _networkReady) ? () => context.go('/telehealth/call?appointmentId=$appointmentId&sessionId=$sessionId') : null,
                    icon: const Icon(Icons.video_call_outlined),
                    label: const Text('Join video visit'),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _WaitingRoomPayload {
  const _WaitingRoomPayload({this.appointment, this.session});

  final Map<String, dynamic>? appointment;
  final Map<String, dynamic>? session;
}

DateTime? _parseDate(Object? value) => DateTime.tryParse(value?.toString() ?? '');

String _formatDateTime(DateTime? value) {
  if (value == null) return 'Time pending';
  return DateFormat('EEE, d MMM • h:mm a').format(value.toLocal());
}
