import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/state/app_session.dart';
import '../../../../core/widgets/patient_ui.dart';

class InCallTelehealthPage extends StatefulWidget {
  const InCallTelehealthPage({super.key, this.appointmentId, this.sessionId});

  final String? appointmentId;
  final String? sessionId;

  @override
  State<InCallTelehealthPage> createState() => _InCallTelehealthPageState();
}

class _InCallTelehealthPageState extends State<InCallTelehealthPage> {
  late Future<_CallPayload> _future;
  bool _muted = false;
  bool _cameraOn = true;
  bool _chatOpen = false;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_CallPayload> _load() async {
    final List<Map<String, dynamic>> sessions = (((await AppSession.instance.telehealthSessions())['items'] as List<dynamic>?) ?? <dynamic>[]).whereType<Map<String, dynamic>>().toList();
    final List<Map<String, dynamic>> appointments = (((await AppSession.instance.appointments())['items'] as List<dynamic>?) ?? <dynamic>[]).whereType<Map<String, dynamic>>().toList();

    Map<String, dynamic>? session;
    if ((widget.sessionId ?? '').isNotEmpty) {
      session = sessions.cast<Map<String, dynamic>?>().firstWhere((Map<String, dynamic>? item) => item?['id']?.toString() == widget.sessionId, orElse: () => null);
    }
    session ??= sessions.cast<Map<String, dynamic>?>().firstWhere((Map<String, dynamic>? item) => item?['appointmentId']?.toString() == widget.appointmentId, orElse: () => null);
    session ??= sessions.isNotEmpty ? sessions.first : null;

    Map<String, dynamic>? appointment;
    final String appointmentId = widget.appointmentId ?? session?['appointmentId']?.toString() ?? '';
    if (appointmentId.isNotEmpty) {
      appointment = appointments.cast<Map<String, dynamic>?>().firstWhere((Map<String, dynamic>? item) => item?['id']?.toString() == appointmentId, orElse: () => null);
    }
    appointment ??= appointments.isNotEmpty ? appointments.first : null;

    return _CallPayload(appointment: appointment, session: session);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: FutureBuilder<_CallPayload>(
        future: _future,
        builder: (BuildContext context, AsyncSnapshot<_CallPayload> snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator(color: Colors.white));
          }
          if (snapshot.hasError) {
            return Center(child: Text(snapshot.error.toString(), style: const TextStyle(color: Colors.white)));
          }
          final _CallPayload payload = snapshot.data ?? const _CallPayload();
          final Map<String, dynamic>? appointment = payload.appointment;
          final Map<String, dynamic>? session = payload.session;
          final String appointmentId = appointment?['id']?.toString() ?? widget.appointmentId ?? '';
          final String providerName = appointment?['providerName']?.toString() ?? 'CarePoint clinician';
          final String patientName = AppSession.instance.me?['name']?.toString() ?? 'You';

          return SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                children: <Widget>[
                  Row(
                    children: <Widget>[
                      const PatientTag(label: 'Live', backgroundColor: Color(0xFF052E16), foregroundColor: Color(0xFF86EFAC), icon: Icons.radio_button_checked),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          appointment?['service']?.toString() ?? 'Virtual consultation',
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 18),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      IconButton(
                        onPressed: () => context.go('/encounter/summary?appointmentId=$appointmentId'),
                        icon: const Icon(Icons.call_end_rounded, color: Colors.white),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Expanded(
                    child: Column(
                      children: <Widget>[
                        Expanded(
                          flex: 5,
                          child: Container(
                            width: double.infinity,
                            decoration: BoxDecoration(
                              color: const Color(0xFF1E293B),
                              borderRadius: BorderRadius.circular(30),
                              border: Border.all(color: const Color(0xFF334155)),
                            ),
                            child: Stack(
                              children: <Widget>[
                                Center(
                                  child: Column(
                                    mainAxisSize: MainAxisSize.min,
                                    children: <Widget>[
                                      CircleAvatar(radius: 44, backgroundColor: const Color(0xFF0EA5E9), child: Text(providerName.isNotEmpty ? providerName.characters.first : 'C', style: const TextStyle(fontSize: 28, color: Colors.white, fontWeight: FontWeight.w700))),
                                      const SizedBox(height: 14),
                                      Text(providerName, style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w700)),
                                      const SizedBox(height: 6),
                                      Text(session?['status']?.toString() ?? 'Connected', style: const TextStyle(color: Color(0xFFCBD5E1))),
                                    ],
                                  ),
                                ),
                                Positioned(
                                  right: 16,
                                  bottom: 16,
                                  child: Container(
                                    width: 118,
                                    padding: const EdgeInsets.all(10),
                                    decoration: BoxDecoration(color: const Color(0xFF020617).withValues(alpha: 0.75), borderRadius: BorderRadius.circular(20)),
                                    child: Column(
                                      mainAxisSize: MainAxisSize.min,
                                      children: <Widget>[
                                        Icon(_cameraOn ? Icons.videocam_rounded : Icons.videocam_off_rounded, color: Colors.white),
                                        const SizedBox(height: 6),
                                        Text(patientName, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 14),
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(color: const Color(0xFF111827), borderRadius: BorderRadius.circular(26), border: Border.all(color: const Color(0xFF1F2937))),
                          child: Column(
                            children: <Widget>[
                              Row(
                                children: <Widget>[
                                  Expanded(child: _DarkMetric(label: 'Mode', value: _cameraOn ? 'Video' : 'Audio')),
                                  const SizedBox(width: 12),
                                  Expanded(child: _DarkMetric(label: 'Audio', value: _muted ? 'Muted' : 'Live')),
                                  const SizedBox(width: 12),
                                  Expanded(child: _DarkMetric(label: 'Notes', value: _chatOpen ? 'Open' : 'Closed')),
                                ],
                              ),
                              const SizedBox(height: 16),
                              if (_chatOpen)
                                Container(
                                  width: double.infinity,
                                  padding: const EdgeInsets.all(14),
                                  decoration: BoxDecoration(color: const Color(0xFF0F172A), borderRadius: BorderRadius.circular(18)),
                                  child: const Text('CarePoint note panel\n• Allergies reviewed\n• Medication reconciliation complete\n• Follow-up summary will be available after the visit', style: TextStyle(color: Colors.white70, height: 1.5)),
                                ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: <Widget>[
                      _CallControl(icon: _muted ? Icons.mic_off_rounded : Icons.mic_none_rounded, active: _muted, label: _muted ? 'Unmute' : 'Mute', onTap: () => setState(() => _muted = !_muted)),
                      _CallControl(icon: _cameraOn ? Icons.videocam_rounded : Icons.videocam_off_rounded, active: !_cameraOn, label: _cameraOn ? 'Camera' : 'Camera off', onTap: () => setState(() => _cameraOn = !_cameraOn)),
                      _CallControl(icon: Icons.notes_rounded, active: _chatOpen, label: 'Notes', onTap: () => setState(() => _chatOpen = !_chatOpen)),
                      _CallControl(icon: Icons.call_end_rounded, active: true, danger: true, label: 'Leave', onTap: () => context.go('/encounter/summary?appointmentId=$appointmentId')),
                    ],
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

class _DarkMetric extends StatelessWidget {
  const _DarkMetric({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: const Color(0xFF0F172A), borderRadius: BorderRadius.circular(16)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(label, style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
          const SizedBox(height: 4),
          Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}

class _CallControl extends StatelessWidget {
  const _CallControl({required this.icon, required this.active, required this.label, required this.onTap, this.danger = false});

  final IconData icon;
  final bool active;
  final String label;
  final VoidCallback onTap;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    final Color bg = danger ? const Color(0xFF7F1D1D) : active ? const Color(0xFF164E63) : const Color(0xFF1E293B);
    return InkWell(
      borderRadius: BorderRadius.circular(22),
      onTap: onTap,
      child: Column(
        children: <Widget>[
          Container(
            width: 62,
            height: 62,
            decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(22)),
            child: Icon(icon, color: Colors.white),
          ),
          const SizedBox(height: 8),
          Text(label, style: const TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class _CallPayload {
  const _CallPayload({this.appointment, this.session});

  final Map<String, dynamic>? appointment;
  final Map<String, dynamic>? session;
}
