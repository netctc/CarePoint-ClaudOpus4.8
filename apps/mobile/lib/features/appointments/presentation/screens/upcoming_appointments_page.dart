import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/state/app_session.dart';
import '../../../../core/widgets/patient_ui.dart';

class UpcomingAppointmentsPage extends StatefulWidget {
  const UpcomingAppointmentsPage({super.key});

  @override
  State<UpcomingAppointmentsPage> createState() => _UpcomingAppointmentsPageState();
}

class _UpcomingAppointmentsPageState extends State<UpcomingAppointmentsPage> {
  late Future<Map<String, dynamic>> _future;
  late String _subjectKey;
  String _filter = 'all';

  String get _currentSubjectKey => '${AppSession.instance.activeSubjectId ?? 'self'}|${AppSession.instance.activeSubjectLabel}';

  @override
  void initState() {
    super.initState();
    _subjectKey = _currentSubjectKey;
    AppSession.instance.addListener(_handleSessionChange);
    _future = AppSession.instance.appointments();
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
    final Future<Map<String, dynamic>> refreshed = AppSession.instance.appointments();
    if (mounted) {
      setState(() { _future = refreshed; });
    }
  }

  Future<void> _reload() async {
    _subjectKey = _currentSubjectKey;
    final Future<Map<String, dynamic>> refreshed = AppSession.instance.appointments();
    setState(() { _future = refreshed; });
    await refreshed;
  }

  @override
  Widget build(BuildContext context) {
    return PatientScaffold(
      currentIndex: 1,
      title: 'Appointments',
      subtitle: 'Upcoming and past visits in one timeline.',
      child: FutureBuilder<Map<String, dynamic>>(
        future: _future,
        builder: (BuildContext context, AsyncSnapshot<Map<String, dynamic>> snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: PatientEmptyState(
                  title: 'Could not load appointments',
                  body: snapshot.error.toString(),
                  icon: Icons.cloud_off_outlined,
                  action: FilledButton.tonal(onPressed: _reload, child: const Text('Try again')),
                ),
              ),
            );
          }

          final List<Map<String, dynamic>> items = ((snapshot.data?['items'] as List<dynamic>?) ?? <dynamic>[]).whereType<Map<String, dynamic>>().toList();
          final DateTime now = DateTime.now();
          final List<Map<String, dynamic>> filtered = items.where((Map<String, dynamic> item) {
            final DateTime? startsAt = _parseDate(item['startsAt']);
            if (_filter == 'upcoming') return startsAt == null || !startsAt.isBefore(now);
            if (_filter == 'past') return startsAt != null && startsAt.isBefore(now);
            return true;
          }).toList()
            ..sort((Map<String, dynamic> a, Map<String, dynamic> b) {
              final DateTime first = _parseDate(a['startsAt']) ?? now;
              final DateTime second = _parseDate(b['startsAt']) ?? now;
              return first.compareTo(second);
            });

          return RefreshIndicator(
            onRefresh: _reload,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(24, 10, 24, 24),
              children: <Widget>[
                PatientHeroCard(
                  badge: 'Visit timeline',
                  title: 'Appointments at a glance',
                  subtitle: 'Open visit details, telehealth waiting rooms, and past summaries from one place.',
                  child: FilledButton.tonalIcon(
                    onPressed: () => context.go('/providers/search'),
                    icon: const Icon(Icons.add_circle_outline),
                    label: const Text('New appointment'),
                  ),
                ),
                const SizedBox(height: 16),
                if (!AppSession.instance.isSelfSubject) ...<Widget>[
                  PatientActiveProfileCard(label: AppSession.instance.activeSubjectLabel, relationship: AppSession.instance.activeSubjectRelationship),
                  const SizedBox(height: 16),
                ],
                PatientTintedCard(
                  tint: const Color(0xFFF5F9FF),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      const Icon(Icons.verified_user_outlined),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: const <Widget>[
                            Text('Profile-linked booking', style: TextStyle(fontWeight: FontWeight.w700)),
                            SizedBox(height: 6),
                            Text('New appointments are created for the active family profile member. Appointment type is selected in the booking flow, and doctor access consent can be granted or revoked from the appointment detail screen.'),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: <Widget>[
                    _FilterChip(label: 'All', selected: _filter == 'all', onTap: () => setState(() => _filter = 'all')),
                    _FilterChip(label: 'Upcoming', selected: _filter == 'upcoming', onTap: () => setState(() => _filter = 'upcoming')),
                    _FilterChip(label: 'Past', selected: _filter == 'past', onTap: () => setState(() => _filter = 'past')),
                  ],
                ),
                const SizedBox(height: 16),
                if (filtered.isEmpty)
                  PatientEmptyState(
                    title: 'No appointments match this view',
                    body: 'Book a new visit or switch the filter to see previous appointments.',
                    icon: Icons.event_available_outlined,
                    action: FilledButton(onPressed: () => context.go('/providers/search'), child: const Text('New appointment')),
                  )
                else
                  ...filtered.map((Map<String, dynamic> item) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: _AppointmentCard(item: item),
                      )),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _AppointmentCard extends StatelessWidget {
  const _AppointmentCard({required this.item});

  final Map<String, dynamic> item;

  @override
  Widget build(BuildContext context) {
    final String appointmentId = item['id']?.toString() ?? '';
    final DateTime? startsAt = _parseDate(item['startsAt']);
    final String location = item['location']?.toString() ?? '';
    final bool isTelehealth = item['telehealthSession'] != null || location.toLowerCase().contains('tele') || location.toLowerCase().contains('virtual');
    final String status = item['status']?.toString() ?? 'REQUESTED';
    final String appointmentType = item['appointmentType']?.toString() ?? (isTelehealth ? 'ONLINE_MEETING' : 'IN_PERSON_VISIT');

    return PatientCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Expanded(child: Text(item['providerName']?.toString() ?? 'Provider', style: Theme.of(context).textTheme.titleMedium)),
              PatientStatusBadge(label: status),
            ],
          ),
          if ((item['subjectLabel']?.toString() ?? '').isNotEmpty) ...<Widget>[
            const SizedBox(height: 6),
            PatientTag(label: 'Dependent profile • ${item['subjectLabel']}', icon: Icons.family_restroom_outlined),
          ],
          const SizedBox(height: 6),
          Text(item['service']?.toString() ?? 'Consultation', style: Theme.of(context).textTheme.bodyLarge?.copyWith(color: AppColors.textPrimary)),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: <Widget>[
              PatientTag(label: appointmentType == 'ONLINE_MEETING' ? 'Online Meeting' : 'In-Person Visit', icon: appointmentType == 'ONLINE_MEETING' ? Icons.videocam_outlined : Icons.meeting_room_outlined),
              if ((item['providerAccess'] as Map?)?['consentStatus']?.toString() == 'GRANTED') const PatientTag(label: 'Doctor access granted', icon: Icons.verified_user_outlined),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: <Widget>[
              const Icon(Icons.schedule_outlined, size: 18, color: AppColors.textSecondary),
              const SizedBox(width: 6),
              Expanded(child: Text(_formatDateTime(startsAt), style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.textPrimary))),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: <Widget>[
              Icon(isTelehealth ? Icons.videocam_outlined : Icons.location_on_outlined, size: 18, color: AppColors.textSecondary),
              const SizedBox(width: 6),
              Expanded(child: Text(location.isEmpty ? (isTelehealth ? 'Telehealth' : 'Facility pending') : location, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.textPrimary))),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: <Widget>[
              Expanded(
                child: OutlinedButton(
                  onPressed: appointmentId.isEmpty ? null : () => context.go('/appointments/detail?id=$appointmentId'),
                  child: const Text('View details'),
                ),
              ),
              if (isTelehealth) ...<Widget>[
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton(
                    onPressed: appointmentId.isEmpty ? null : () => context.go('/telehealth/waiting?appointmentId=$appointmentId'),
                    child: const Text('Join visit'),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({required this.label, required this.selected, required this.onTap});

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ChoiceChip(label: Text(label), selected: selected, onSelected: (_) => onTap());
  }
}

DateTime? _parseDate(dynamic value) {
  if (value == null) return null;
  return DateTime.tryParse(value.toString())?.toLocal();
}

String _formatDateTime(DateTime? value) {
  if (value == null) return 'Time pending';
  final String month = <String>['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][value.month - 1];
  final int hour = value.hour == 0 ? 12 : (value.hour > 12 ? value.hour - 12 : value.hour);
  final String minute = value.minute.toString().padLeft(2, '0');
  final String suffix = value.hour >= 12 ? 'PM' : 'AM';
  return '$month ${value.day}, ${value.year} • $hour:$minute $suffix';
}
