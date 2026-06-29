import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/state/provider_session.dart';
import '../../../../core/utils/json_utils.dart';
import '../../../../core/widgets/provider_ui.dart';

class ProviderDashboardPage extends StatefulWidget {
  const ProviderDashboardPage({super.key});

  @override
  State<ProviderDashboardPage> createState() => _ProviderDashboardPageState();
}

class _ProviderDashboardPageState extends State<ProviderDashboardPage> {
  late Future<Map<String, dynamic>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<Map<String, dynamic>> _load() async {
    final api = ProviderSession.instance.api;
    return <String, dynamic>{
      'dashboard': await api.dashboard(),
      'alerts': await api.alerts(),
      'telehealth': await api.telehealthSessions(),
    };
  }

  void _refresh() {
    setState(() {
      _future = _load();
    });
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const ProviderPage(child: LoadingBlock());
        }
        if (snapshot.hasError) {
          return ProviderPage(child: ErrorStateCard(message: snapshot.error.toString(), onRetry: _refresh));
        }

        final Map<String, dynamic> data = snapshot.data ?? <String, dynamic>{};
        final Map<String, dynamic> dashboard = pickMap(data['dashboard'], const <String>['dashboard', 'data']);
        final Map<String, dynamic> kpis = pickMap(dashboard, const <String>['kpis', 'summary']);
        final List<Map<String, dynamic>> queue = pickList(dashboard, const <String>['queue', 'appointments', 'items']);
        final List<Map<String, dynamic>> alerts = pickList(data['alerts'], const <String>['alerts', 'items']);
        final List<Map<String, dynamic>> sessions = pickList(data['telehealth'], const <String>['items', 'sessions']);

        // Sort appointments by time (earliest first)
        queue.sort((a, b) {
          final String timeA = readString(a, const <String>['startsAt', 'time'], fallback: '');
          final String timeB = readString(b, const <String>['startsAt', 'time'], fallback: '');
          return timeA.compareTo(timeB);
        });

        return SafeArea(
          top: false,
          child: RefreshIndicator(
            onRefresh: () async => _refresh(),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
              children: <Widget>[
                // Compact welcome
                Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: Row(
                    children: <Widget>[
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            Text('Hello, ${ProviderSession.instance.displayName.split(' ').first}', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
                            const SizedBox(height: 2),
                            Text(ProviderSession.instance.categoryLabel, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.grey[600])),
                          ],
                        ),
                      ),
                      IconButton.filledTonal(onPressed: _refresh, icon: const Icon(Icons.refresh_rounded, size: 20)),
                    ],
                  ),
                ),

                // Compact metric cards (smaller)
                GridView.count(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  crossAxisCount: 2,
                  mainAxisSpacing: 8,
                  crossAxisSpacing: 8,
                  childAspectRatio: 2.2,
                  children: <Widget>[
                    _TappableMetricCard(
                      label: 'Today\'s appts',
                      value: '${readInt(kpis, const <String>['todaysAppointments', 'appointmentsToday'])}',
                      icon: Icons.event_note_rounded,
                      onTap: () => context.go('/queue'),
                    ),
                    _TappableMetricCard(
                      label: 'Waiting',
                      value: '${readInt(kpis, const <String>['waitingPatients', 'waiting'])}',
                      icon: Icons.hourglass_top_rounded,
                      color: const Color(0xFFF59E0B),
                      onTap: () => context.go('/queue'),
                    ),
                    _TappableMetricCard(
                      label: 'Messages',
                      value: '${readInt(kpis, const <String>['unreadMessages', 'messagesUnread'])}',
                      icon: Icons.chat_bubble_outline_rounded,
                      color: const Color(0xFF1565C0),
                      onTap: () => context.go('/messages'),
                    ),
                    _TappableMetricCard(
                      label: 'Alerts',
                      value: '${readInt(kpis, const <String>['openAlerts', 'alertsOpen'])}',
                      icon: Icons.warning_amber_rounded,
                      color: const Color(0xFFDC2626),
                      onTap: () => context.go('/alerts'),
                    ),
                  ],
                ),

                // Today's appointments (sorted earliest→latest, linkable)
                const SizedBox(height: 16),
                const SectionTitle(title: 'Today\'s appointments'),
                const SizedBox(height: 8),
                if (queue.isEmpty)
                  const EmptyStateCard(title: 'No appointments today', subtitle: 'Your schedule is clear.', icon: Icons.event_available_rounded)
                else
                  ...queue.take(5).map((item) => _LinkableListTile(
                        title: readString(item, const <String>['patientName', 'patient', 'subjectLabel']),
                        subtitle: readString(item, const <String>['time', 'startsAt'], fallback: '—'),
                        trailing: readString(item, const <String>['status'], fallback: 'Pending'),
                        onTap: () {
                          final String id = readString(item, const <String>['id'], fallback: '');
                          if (id.isNotEmpty && id != '—') context.go('/appointments/$id');
                        },
                      )),

                // Waiting patients (by arrival order, linkable)
                const SizedBox(height: 16),
                const SectionTitle(title: 'Waiting patients'),
                const SizedBox(height: 8),
                if (queue.where((q) => readString(q, const <String>['status']).toLowerCase().contains('wait')).isEmpty)
                  const EmptyStateCard(title: 'No patients waiting', subtitle: 'Patients will appear here when they check in.', icon: Icons.people_outline_rounded)
                else
                  ...queue.where((q) => readString(q, const <String>['status']).toLowerCase().contains('wait')).take(5).map((item) => _LinkableListTile(
                        title: readString(item, const <String>['patientName', 'patient', 'subjectLabel']),
                        subtitle: readString(item, const <String>['reason', 'service']),
                        trailing: readString(item, const <String>['time', 'startsAt'], fallback: ''),
                        onTap: () {
                          final String id = readString(item, const <String>['id'], fallback: '');
                          if (id.isNotEmpty && id != '—') context.go('/appointments/$id');
                        },
                      )),

                // Unread messages (linkable)
                const SizedBox(height: 16),
                Row(
                  children: <Widget>[
                    const Expanded(child: SectionTitle(title: 'Unread messages')),
                    TextButton(onPressed: () => context.go('/messages'), child: const Text('View all')),
                  ],
                ),
                const SizedBox(height: 8),
                const EmptyStateCard(title: 'Messages load from inbox', subtitle: 'Tap to open your message threads.', icon: Icons.chat_bubble_outline_rounded),

                // Open alerts (linkable to patient profile)
                const SizedBox(height: 16),
                Row(
                  children: <Widget>[
                    const Expanded(child: SectionTitle(title: 'Open alerts')),
                    TextButton(onPressed: () => context.go('/alerts'), child: const Text('View all')),
                  ],
                ),
                const SizedBox(height: 8),
                if (alerts.isEmpty)
                  const EmptyStateCard(title: 'No active alerts', subtitle: 'All clear.', icon: Icons.verified_rounded)
                else
                  ...alerts.take(4).map((item) => _LinkableListTile(
                        title: readString(item, const <String>['title', 'name']),
                        subtitle: readString(item, const <String>['detail', 'description', 'summary']),
                        trailing: readString(item, const <String>['severity', 'status'], fallback: 'Open'),
                        onTap: () {
                          final String patientId = readString(item, const <String>['patientId', 'patient_id'], fallback: '');
                          if (patientId.isNotEmpty && patientId != '—') {
                            context.go('/chart/$patientId');
                          } else {
                            context.go('/alerts');
                          }
                        },
                      )),

                // Telehealth sessions
                if (sessions.isNotEmpty) ...<Widget>[
                  const SizedBox(height: 16),
                  const SectionTitle(title: 'Telehealth'),
                  const SizedBox(height: 8),
                  ...sessions.take(3).map((item) => _LinkableListTile(
                        title: readString(item, const <String>['patientName', 'patient', 'subjectLabel']),
                        subtitle: readString(item, const <String>['service', 'reason'], fallback: 'Telehealth session'),
                        trailing: readString(item, const <String>['status'], fallback: 'Ready'),
                        onTap: () {
                          final String sessionId = readString(item, const <String>['id'], fallback: '');
                          if (sessionId.isNotEmpty && sessionId != '—') context.go('/telehealth/$sessionId');
                        },
                      )),
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}

/// Compact tappable metric card
class _TappableMetricCard extends StatelessWidget {
  const _TappableMetricCard({required this.label, required this.value, required this.icon, required this.onTap, this.color});

  final String label;
  final String value;
  final IconData icon;
  final VoidCallback onTap;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final Color cardColor = color ?? Theme.of(context).colorScheme.primary;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: cardColor.withOpacity(0.08),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: cardColor.withOpacity(0.15)),
        ),
        child: Row(
          children: <Widget>[
            Icon(icon, color: cardColor, size: 22),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(value, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800, fontSize: 20, color: cardColor)),
                  Text(label, style: Theme.of(context).textTheme.bodySmall?.copyWith(fontSize: 11, color: Colors.grey[700]), maxLines: 1, overflow: TextOverflow.ellipsis),
                ],
              ),
            ),
            Icon(Icons.chevron_right_rounded, color: Colors.grey[400], size: 18),
          ],
        ),
      ),
    );
  }
}

/// Linkable list tile used for appointments, alerts, etc.
class _LinkableListTile extends StatelessWidget {
  const _LinkableListTile({required this.title, required this.subtitle, this.trailing, required this.onTap});

  final String title;
  final String subtitle;
  final String? trailing;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.grey.shade200),
          ),
          child: Row(
            children: <Widget>[
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(title, style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis),
                    if (subtitle.isNotEmpty)
                      Text(subtitle, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Colors.grey[600]), maxLines: 1, overflow: TextOverflow.ellipsis),
                  ],
                ),
              ),
              if (trailing != null && trailing!.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(left: 8),
                  child: StatusBadge(trailing!),
                ),
              const SizedBox(width: 4),
              Icon(Icons.chevron_right_rounded, color: Colors.grey[400], size: 18),
            ],
          ),
        ),
      ),
    );
  }
}
