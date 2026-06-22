import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/localization/app_localizations.dart';
import '../../../../core/state/app_session.dart';
import '../../../../core/widgets/patient_ui.dart';

class HomeDashboardPage extends StatefulWidget {
  const HomeDashboardPage({super.key});

  @override
  State<HomeDashboardPage> createState() => _HomeDashboardPageState();
}

class _HomeDashboardPageState extends State<HomeDashboardPage> {
  late Future<_HomeDashboardData> _future;
  late String _subjectKey;

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
    final Future<_HomeDashboardData> refreshed = _load();
    if (mounted) {
      setState(() { _future = refreshed; });
    }
  }

  Future<_HomeDashboardData> _load() async {
    final List<dynamic> responses = await Future.wait<dynamic>(<Future<dynamic>>[
      AppSession.instance.dashboard(),
      AppSession.instance.patientLabs(),
    ]);

    final Map<String, dynamic> dashboard = (responses[0] as Map<String, dynamic>?) ?? <String, dynamic>{};
    final Map<String, dynamic> home = (dashboard['home'] as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{};
    final Map<String, dynamic> reminderSection = (home['reminders'] as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{};
    final Map<String, dynamic> vitalsSection = (home['vitals'] as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{};
    final Map<String, dynamic> questionnaireSection = (home['questionnaire'] as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{};
    final List<Map<String, dynamic>> appointments = ((home['upcomingAppointments'] as List?) ?? <dynamic>[]).whereType<Map>().map((Map item) => item.cast<String, dynamic>()).toList();
    final List<Map<String, dynamic>> reminders = ((reminderSection['items'] as List?) ?? <dynamic>[]).whereType<Map>().map((Map item) => item.cast<String, dynamic>()).toList();
    final Map<String, dynamic> reminderSummary = (reminderSection['summary'] as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{};
    final List<Map<String, dynamic>> labs = (((responses[1] as Map<String, dynamic>?)?['items']) as List<dynamic>? ?? <dynamic>[])
        .whereType<Map<String, dynamic>>()
        .map((Map<String, dynamic> item) => <String, dynamic>{...item, 'diagnosticSource': 'Released lab result'})
        .toList();
    final List<Map<String, dynamic>> patientReports = await _loadPatientDiagnosticReports();
    final Map<String, dynamic> rpmSummary = (vitalsSection['summary'] as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{};
    final List<Map<String, dynamic>> rpmReadings = ((vitalsSection['latestReadings'] as List?) ?? <dynamic>[]).whereType<Map>().map((Map item) => item.cast<String, dynamic>()).toList();
    final Map<String, dynamic>? questionnaireLatest = (questionnaireSection['latest'] as Map?)?.cast<String, dynamic>();

    appointments.sort((Map<String, dynamic> a, Map<String, dynamic> b) {
      final DateTime first = _parseDateTime(a['startsAt']) ?? DateTime.now();
      final DateTime second = _parseDateTime(b['startsAt']) ?? DateTime.now();
      return first.compareTo(second);
    });
    final DateTime now = DateTime.now();
    final List<Map<String, dynamic>> upcomingAppointments = appointments.where((Map<String, dynamic> item) {
      final DateTime? startsAt = _parseDateTime(item['startsAt']);
      final String status = (item['status']?.toString() ?? '').toUpperCase();
      return startsAt != null && !startsAt.isBefore(now) && status != 'CANCELLED' && status != 'COMPLETED' && status != 'NO_SHOW';
    }).toList();

    final List<Map<String, dynamic>> diagnosticResults = <Map<String, dynamic>>[
      ...labs,
      ...patientReports,
    ];
    diagnosticResults.sort((Map<String, dynamic> a, Map<String, dynamic> b) {
      final DateTime first = _parseDateTime(a['recordedAt'] ?? a['updatedAt'] ?? a['createdAt'] ?? a['reportDate']) ?? DateTime.fromMillisecondsSinceEpoch(0);
      final DateTime second = _parseDateTime(b['recordedAt'] ?? b['updatedAt'] ?? b['createdAt'] ?? b['reportDate']) ?? DateTime.fromMillisecondsSinceEpoch(0);
      return second.compareTo(first);
    });

    rpmReadings.sort((Map<String, dynamic> a, Map<String, dynamic> b) {
      final DateTime first = _parseDateTime(a['time']) ?? DateTime.fromMillisecondsSinceEpoch(0);
      final DateTime second = _parseDateTime(b['time']) ?? DateTime.fromMillisecondsSinceEpoch(0);
      return second.compareTo(first);
    });

    return _HomeDashboardData(
      dashboard: dashboard,
      upcomingAppointments: upcomingAppointments,
      reminders: reminders,
      reminderSummary: reminderSummary,
      latestLabs: diagnosticResults.take(3).toList(),
      rpmSummary: rpmSummary,
      rpmReadings: rpmReadings,
      questionnaireLatest: questionnaireLatest,
    );
  }


  Future<List<Map<String, dynamic>>> _loadPatientDiagnosticReports() async {
    try {
      final Map<String, dynamic> result = await AppSession.instance.loadMedicalProfile();
      final Map<String, dynamic> medical = (result['medical'] as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{};
      return (((medical['reports'] as List?) ?? <dynamic>[])
          .whereType<Map>()
          .map((Map item) {
            final Map<String, dynamic> report = item.cast<String, dynamic>();
            final String notes = report['notes']?.toString() ?? '';
            return <String, dynamic>{
              ...report,
              'id': report['id']?.toString() ?? report['fileName']?.toString() ?? 'patient-report',
              'title': report['fileName']?.toString() ?? report['category']?.toString() ?? 'Uploaded diagnostic report',
              'summary': notes.isNotEmpty ? notes : report['category']?.toString(),
              'diagnosticSource': 'Patient-uploaded report',
              'createdAt': report['reportDate']?.toString() ?? report['createdAt']?.toString(),
            };
          })
          .toList());
    } catch (_) {
      return <Map<String, dynamic>>[];
    }
  }

  Future<void> _reload() async {
    _subjectKey = _currentSubjectKey;
    final Future<_HomeDashboardData> refreshed = _load();
    setState(() { _future = refreshed; });
    await refreshed;
  }

  @override
  Widget build(BuildContext context) {
    final Map<String, dynamic>? me = AppSession.instance.me;
    final String firstName = (me?['patientProfile'] as Map<String, dynamic>?)?['firstName']?.toString() ?? 'there';

    return PatientScaffold(
      currentIndex: 0,
      title: 'CarePoint',
      subtitle: "${context.l10n.t('home.activeProfile')}: ${AppSession.instance.activeSubjectLabel}",
      actions: <Widget>[
        IconButton.filledTonal(
          onPressed: () {
            AppSession.instance.logout();
            context.go('/sign-in');
          },
          icon: const Icon(Icons.logout),
        ),
      ],
      child: FutureBuilder<_HomeDashboardData>(
        future: _future,
        builder: (BuildContext context, AsyncSnapshot<_HomeDashboardData> snapshot) {
          if (snapshot.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
          if (snapshot.hasError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: PatientEmptyState(
                  title: 'Could not load your dashboard',
                  body: snapshot.error.toString(),
                  icon: Icons.cloud_off_outlined,
                  action: FilledButton.tonal(onPressed: _reload, child: const Text('Try again')),
                ),
              ),
            );
          }

          final _HomeDashboardData data = snapshot.data!;
          final Map<String, dynamic> dashboard = data.dashboard;
          final Map<String, dynamic> notifications = (dashboard['notifications'] as Map<String, dynamic>?) ?? <String, dynamic>{};
          final Map<String, dynamic> refillSnapshot = (dashboard['refillSnapshot'] as Map<String, dynamic>?) ?? <String, dynamic>{};
          final List<Map<String, dynamic>> latestNotificationItems = ((notifications['latest'] as List<dynamic>?) ?? <dynamic>[]).whereType<Map<String, dynamic>>().toList();
          final Map<String, dynamic>? nextAppointment = data.upcomingAppointments.isEmpty
              ? ((dashboard['nextAppointment'] as Map?)?.cast<String, dynamic>())
              : data.upcomingAppointments.first;
          final Map<String, dynamic>? latestVital = data.rpmReadings.isEmpty ? null : data.rpmReadings.first;
          final Map<String, dynamic>? questionnaireLatest = data.questionnaireLatest;
          final l10n = context.l10n;

          return RefreshIndicator(
            onRefresh: _reload,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(24, 10, 24, 24),
              children: <Widget>[
                PatientHeroCard(
                  badge: '${l10n.t('home.welcomeBack')}, $firstName',
                  title: nextAppointment == null ? l10n.t('home.readyToBook') : (nextAppointment['providerName']?.toString() ?? 'Upcoming appointment'),
                  subtitle: nextAppointment == null
                      ? l10n.t('home.readyToBookBody')
                      : '${nextAppointment['service']} • ${_formatDateTime(nextAppointment['startsAt'])}',
                  child: FilledButton.tonal(
                    onPressed: () => context.go(nextAppointment == null ? '/providers/search' : '/appointments/upcoming'),
                    style: FilledButton.styleFrom(backgroundColor: Colors.white, foregroundColor: AppColors.primaryDark),
                    child: Text(nextAppointment == null ? l10n.t('home.findProvider') : l10n.t('home.viewAppointments')),
                  ),
                ),
                const SizedBox(height: 18),
                PatientSectionTitle(title: 'Quick actions'),
                const SizedBox(height: 12),
                PatientCard(
                  child: Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: <Widget>[
                      _QuickAction(label: 'Family profile', icon: Icons.family_restroom_outlined, onTap: () => context.go('/family/profiles')),
                      _QuickAction(label: 'Profile', icon: Icons.badge_outlined, onTap: () => context.go('/profile-setup')),
                      _QuickAction(label: l10n.t('home.bookCare'), icon: Icons.search, onTap: () => context.go('/providers/search')),
                      _QuickAction(label: l10n.t('home.messages'), icon: Icons.chat_bubble_outline, onTap: () => context.go('/messages/inbox')),
                      _QuickAction(label: l10n.t('home.labs'), icon: Icons.science_outlined, onTap: () => context.go('/labs/list')),
                      _QuickAction(label: 'Vitals', icon: Icons.monitor_heart_outlined, onTap: () => context.go('/rpm/trends')),
                      _QuickAction(label: 'Reminders', icon: Icons.alarm_outlined, onTap: () => context.go('/reminders/medication')),
                    ],
                  ),
                ),
                const SizedBox(height: 18),
                PatientSectionTitle(title: 'Upcoming appointment reminder'),
                const SizedBox(height: 12),
                if (nextAppointment == null)
                  PatientEmptyState(
                    title: 'No upcoming appointments',
                    body: 'Book a new online or in-person appointment for the active family profile.',
                    icon: Icons.event_busy_outlined,
                    action: FilledButton(onPressed: () => context.go('/providers/search'), child: const Text('New appointment')),
                  )
                else
                  PatientCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Row(
                          children: <Widget>[
                            Expanded(child: Text(nextAppointment['providerName']?.toString() ?? 'Provider', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700))),
                            PatientStatusBadge(label: nextAppointment['status']?.toString() ?? 'CONFIRMED'),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(nextAppointment['service']?.toString() ?? 'Consultation'),
                        const SizedBox(height: 8),
                        Text(_formatDateTime(nextAppointment['startsAt'])),
                        const SizedBox(height: 8),
                        Text(nextAppointment['location']?.toString() ?? 'Location pending'),
                        const SizedBox(height: 14),
                        Row(
                          children: <Widget>[
                            Expanded(
                              child: FilledButton(
                                onPressed: () => context.go('/appointments/detail?id=${nextAppointment['id']}'),
                                child: const Text('View appointment'),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: OutlinedButton(
                                onPressed: () => context.go('/providers/search'),
                                child: const Text('New appointment'),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                const SizedBox(height: 18),
                Row(
                  children: <Widget>[
                    Expanded(
                      child: PatientMetricCard(
                        label: l10n.t('home.notifications'),
                        value: '${notifications['unreadCount'] ?? 0} ${l10n.t('home.unread')}',
                        caption: '${notifications['highPriorityCount'] ?? 0} ${l10n.t('home.highPriority')}',
                        icon: Icons.notifications_active_outlined,
                        onTap: () => context.go('/notifications/center'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: PatientMetricCard(
                        label: l10n.t('home.refills'),
                        value: '${refillSnapshot['activeCount'] ?? 0} ${l10n.t('home.active')}',
                        caption: '${refillSnapshot['escalatedCount'] ?? 0} ${l10n.t('home.escalated')}',
                        icon: Icons.medication_outlined,
                        onTap: () => context.go('/prescriptions/list'),
                      ),
                    ),
                  ],
                ),
                if (questionnaireLatest != null) ...<Widget>[
                  const SizedBox(height: 18),
                  PatientSectionTitle(title: 'Latest questionnaire result'),
                  const SizedBox(height: 12),
                  PatientCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Text('Version ${questionnaireLatest['versionNumber'] ?? 1}', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                        const SizedBox(height: 8),
                        Text(_questionnaireCompletionLabel(questionnaireLatest)),
                        if ((questionnaireLatest['summary']?.toString() ?? '').isNotEmpty) ...<Widget>[
                          const SizedBox(height: 8),
                          Text(questionnaireLatest['summary'].toString()),
                        ],
                        const SizedBox(height: 12),
                        Align(
                          alignment: Alignment.centerRight,
                          child: OutlinedButton.icon(
                            onPressed: () => context.go('/health-questionnaire'),
                            icon: const Icon(Icons.history_outlined),
                            label: const Text('Review history'),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 18),
                PatientSectionTitle(title: 'Health reminders'),
                const SizedBox(height: 12),
                PatientCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text('${data.reminderSummary['enabledCount'] ?? data.reminders.where((Map<String, dynamic> item) => item['enabled'] == true).length} reminders enabled', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                      const SizedBox(height: 8),
                      if (data.reminders.isEmpty)
                        const Text('Add medication reminders to track schedules from the Home page.')
                      else
                        ...data.reminders.take(2).map((Map<String, dynamic> reminder) => Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: ListTile(
                                contentPadding: EdgeInsets.zero,
                                leading: const Icon(Icons.alarm_outlined),
                                title: Text(reminder['medication']?.toString() ?? 'Medication'),
                                subtitle: Text(reminder['schedule']?.toString() ?? 'Schedule'),
                                trailing: PatientStatusBadge(label: reminder['enabled'] == true ? 'On' : 'Paused'),
                              ),
                            )),
                      Align(
                        alignment: Alignment.centerRight,
                        child: FilledButton.tonalIcon(
                          onPressed: () => context.go('/reminders/medication'),
                          icon: const Icon(Icons.edit_calendar_outlined),
                          label: const Text('Manage reminders'),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),
                PatientSectionTitle(title: 'Latest diagnostic results'),
                const SizedBox(height: 12),
                if (data.latestLabs.isEmpty)
                  PatientEmptyState(
                    title: 'No diagnostic results yet',
                    body: 'This section is fed by released provider/lab results from /api/records/patient-labs and patient-uploaded diagnostic reports from the medical profile.',
                    icon: Icons.science_outlined,
                    action: FilledButton.tonalIcon(onPressed: () => context.go('/profile-setup'), icon: const Icon(Icons.upload_file_outlined), label: const Text('Add report')),
                  )
                else
                  ...data.latestLabs.map((Map<String, dynamic> item) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: PatientCard(
                          child: ListTile(
                            contentPadding: EdgeInsets.zero,
                            onTap: () {
                              final String source = item['diagnosticSource']?.toString() ?? '';
                              if (source.contains('Patient-uploaded')) {
                                context.go('/profile-setup');
                              } else {
                                context.go('/labs/detail?id=${item['id'] ?? item['labResultId'] ?? ''}');
                              }
                            },
                            leading: const Icon(Icons.biotech_outlined),
                            title: Text(item['title']?.toString() ?? item['labName']?.toString() ?? item['fileName']?.toString() ?? 'Diagnostic result'),
                            subtitle: Text('${item['diagnosticSource'] ?? 'Diagnostic'} • ${item['summary']?.toString() ?? item['category']?.toString() ?? _formatDateTime(item['recordedAt'] ?? item['updatedAt'] ?? item['createdAt'] ?? item['reportDate'])}'),
                            trailing: const Icon(Icons.chevron_right),
                          ),
                        ),
                      )),
                const SizedBox(height: 18),
                PatientSectionTitle(title: 'Latest vitals tests'),
                const SizedBox(height: 12),
                PatientCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      if (latestVital == null)
                        const Text('Add new vitals data manually to start tracking trends.')
                      else ...<Widget>[
                        Text(latestVital['metric']?.toString() ?? 'Latest reading', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                        const SizedBox(height: 8),
                        Text(latestVital['value']?.toString() ?? '--'),
                        const SizedBox(height: 8),
                        Text(_formatDateTime(latestVital['time'])),
                      ],
                      const SizedBox(height: 12),
                      if (data.rpmReadings.isNotEmpty)
                        SizedBox(
                          height: 80,
                          child: _VitalSparkline(values: data.rpmReadings.take(8).map((Map<String, dynamic> item) => _numericValue(item['value'])).whereType<double>().toList().reversed.toList()),
                        ),
                      const SizedBox(height: 12),
                      Row(
                        children: <Widget>[
                          Expanded(
                            child: FilledButton.tonalIcon(
                              onPressed: () => context.go('/rpm/trends'),
                              icon: const Icon(Icons.add_chart_outlined),
                              label: const Text('Add vitals'),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: OutlinedButton(
                              onPressed: () => context.go('/rpm/trends'),
                              child: const Text('Open trends'),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),
                PatientSectionTitle(title: l10n.t('home.latestUpdates')),
                const SizedBox(height: 12),
                if (latestNotificationItems.isEmpty)
                  PatientEmptyState(title: l10n.t('home.noNotifications'), body: l10n.t('home.caughtUp'), icon: Icons.notifications_none_outlined)
                else
                  ...latestNotificationItems.take(3).map((Map<String, dynamic> item) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: PatientCard(
                          child: ListTile(
                            contentPadding: EdgeInsets.zero,
                            onTap: () => context.go('/notifications/center'),
                            leading: Container(
                              width: 42,
                              height: 42,
                              decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(14)),
                              child: const Icon(Icons.notifications_active_outlined, color: AppColors.primaryDark),
                            ),
                            title: Text(item['title']?.toString() ?? l10n.t('home.update'), style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w700)),
                            subtitle: Padding(
                              padding: const EdgeInsets.only(top: 6),
                              child: Text(item['message']?.toString() ?? item['body']?.toString() ?? '', style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.textPrimary)),
                            ),
                            trailing: const Icon(Icons.chevron_right),
                          ),
                        ),
                      )),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _HomeDashboardData {
  const _HomeDashboardData({
    required this.dashboard,
    required this.upcomingAppointments,
    required this.reminders,
    required this.reminderSummary,
    required this.latestLabs,
    required this.rpmSummary,
    required this.rpmReadings,
    required this.questionnaireLatest,
  });

  final Map<String, dynamic> dashboard;
  final List<Map<String, dynamic>> upcomingAppointments;
  final List<Map<String, dynamic>> reminders;
  final Map<String, dynamic> reminderSummary;
  final List<Map<String, dynamic>> latestLabs;
  final Map<String, dynamic> rpmSummary;
  final List<Map<String, dynamic>> rpmReadings;
  final Map<String, dynamic>? questionnaireLatest;
}

String _questionnaireCompletionLabel(Map<String, dynamic> item) {
  final Map<String, dynamic> completion = (item['completion'] as Map<String, dynamic>?) ?? <String, dynamic>{};
  final int completed = (completion['completedCount'] as num?)?.toInt() ?? 0;
  final int total = (completion['totalCount'] as num?)?.toInt() ?? 10;
  final int percent = total == 0 ? 0 : ((completed / total) * 100).round();
  return '$completed/$total fields completed • $percent%';
}

DateTime? _parseDateTime(dynamic value) {
  if (value == null) return null;
  return DateTime.tryParse(value.toString())?.toLocal();
}

String _formatDateTime(dynamic value) {
  final DateTime? parsed = _parseDateTime(value);
  if (parsed == null) return AppSession.instance.languageCode == 'ar' ? 'الجدولة قيد الانتظار' : 'Schedule pending';
  return DateFormat('EEE, d MMM • h:mm a').format(parsed.toLocal());
}

double? _numericValue(dynamic value) {
  if (value == null) return null;
  final String text = value.toString().trim();
  final RegExpMatch? match = RegExp(r'(\d+(?:\.\d+)?)').firstMatch(text);
  if (match == null) return null;
  return double.tryParse(match.group(1)!);
}

class _QuickAction extends StatelessWidget {
  const _QuickAction({required this.label, required this.icon, required this.onTap});

  final String label;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(18),
      onTap: onTap,
      child: Ink(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(color: AppColors.surfaceTint, borderRadius: BorderRadius.circular(18)),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Icon(icon, size: 18, color: AppColors.primaryDark),
            const SizedBox(width: 8),
            Text(label, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.textPrimary, fontWeight: FontWeight.w700)),
          ],
        ),
      ),
    );
  }
}

class _VitalSparkline extends StatelessWidget {
  const _VitalSparkline({required this.values});

  final List<double> values;

  @override
  Widget build(BuildContext context) {
    if (values.length < 2) {
      return const Center(child: Text('Trend will appear after more readings are logged.'));
    }
    return CustomPaint(
      painter: _SparklinePainter(values),
      child: Container(),
    );
  }
}

class _SparklinePainter extends CustomPainter {
  _SparklinePainter(this.values);

  final List<double> values;

  @override
  void paint(Canvas canvas, Size size) {
    if (values.length < 2) return;
    final double minValue = values.reduce((double a, double b) => a < b ? a : b);
    final double maxValue = values.reduce((double a, double b) => a > b ? a : b);
    final double span = (maxValue - minValue).abs() < 0.0001 ? 1 : (maxValue - minValue);
    final Paint linePaint = Paint()
      ..color = AppColors.primaryDark
      ..strokeWidth = 3
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;
    final Path path = Path();
    for (int index = 0; index < values.length; index++) {
      final double dx = values.length == 1 ? 0 : (size.width * index / (values.length - 1));
      final double normalized = (values[index] - minValue) / span;
      final double dy = size.height - (normalized * (size.height - 12)) - 6;
      if (index == 0) {
        path.moveTo(dx, dy);
      } else {
        path.lineTo(dx, dy);
      }
    }
    canvas.drawPath(path, linePaint);
  }

  @override
  bool shouldRepaint(covariant _SparklinePainter oldDelegate) => oldDelegate.values != values;
}
