import 'package:flutter/material.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/state/app_session.dart';
import '../../../../core/widgets/patient_ui.dart';

class VitalsRpmTrendsPage extends StatefulWidget {
  const VitalsRpmTrendsPage({super.key});

  @override
  State<VitalsRpmTrendsPage> createState() => _VitalsRpmTrendsPageState();
}

class _VitalsRpmTrendsPageState extends State<VitalsRpmTrendsPage> {
  late Future<_RpmTrendData> _future;
  late String _subjectKey;
  final TextEditingController _metricController = TextEditingController(text: 'Blood pressure');
  final TextEditingController _valueController = TextEditingController();
  String _variant = 'info';
  String _chartMetric = 'Blood pressure';
  bool _submitting = false;

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
    _metricController.dispose();
    _valueController.dispose();
    super.dispose();
  }

  void _handleSessionChange() {
    final String nextKey = _currentSubjectKey;
    if (nextKey == _subjectKey) return;
    _subjectKey = nextKey;
    final Future<_RpmTrendData> refreshed = _load();
    if (mounted) {
      setState(() { _future = refreshed; });
    }
  }

  Future<_RpmTrendData> _load() async {
    final List<dynamic> responses = await Future.wait<dynamic>(<Future<dynamic>>[
      AppSession.instance.patientRpmSummary(),
      AppSession.instance.patientRpmReadings(),
    ]);
    return _RpmTrendData(
      summary: (((responses[0] as Map<String, dynamic>)['summary']) as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{},
      readings: (((responses[1] as Map<String, dynamic>)['items']) as List<dynamic>? ?? <dynamic>[]).whereType<Map<String, dynamic>>().toList(),
    );
  }

  Future<void> _refresh() async {
    _subjectKey = _currentSubjectKey;
    final Future<_RpmTrendData> refreshed = _load();
    setState(() { _future = refreshed; });
    await refreshed;
  }

  Future<void> _submitReading() async {
    if (_metricController.text.trim().isEmpty || _valueController.text.trim().isEmpty) return;
    setState(() => _submitting = true);
    try {
      await AppSession.instance.addPatientRpmReading(metric: _metricController.text.trim(), value: _valueController.text.trim(), status: _variant, variant: _variant);
      _valueController.clear();
      _chartMetric = _metricController.text.trim();
      await _refresh();
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return PatientScaffold(
      title: 'Latest vitals tests',
      subtitle: 'Manual entry, metric filters, and trend charts',
      showBack: true,
      showNavigation: false,
      child: FutureBuilder<_RpmTrendData>(
        future: _future,
        builder: (BuildContext context, AsyncSnapshot<_RpmTrendData> snapshot) {
          if (snapshot.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
          if (snapshot.hasError) return Padding(padding: const EdgeInsets.all(24), child: PatientEmptyState(title: 'Unable to load vitals trends', body: snapshot.error.toString(), icon: Icons.show_chart_outlined, action: FilledButton.tonal(onPressed: _refresh, child: const Text('Retry'))));
          final _RpmTrendData data = snapshot.data!;
          final List<Map<String, dynamic>> sortedReadings = List<Map<String, dynamic>>.from(data.readings)
            ..sort((Map<String, dynamic> a, Map<String, dynamic> b) {
              final DateTime first = DateTime.tryParse(a['time']?.toString() ?? '') ?? DateTime.fromMillisecondsSinceEpoch(0);
              final DateTime second = DateTime.tryParse(b['time']?.toString() ?? '') ?? DateTime.fromMillisecondsSinceEpoch(0);
              return second.compareTo(first);
            });
          final List<String> metrics = <String>{for (final item in sortedReadings) item['metric']?.toString() ?? ''}.where((value) => value.trim().isNotEmpty).toList()..sort();
          if (!metrics.contains(_chartMetric) && metrics.isNotEmpty) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (mounted) setState(() => _chartMetric = metrics.first);
            });
          }
          final List<Map<String, dynamic>> metricReadings = sortedReadings.where((item) => (item['metric']?.toString() ?? '') == _chartMetric).toList();
          final List<double> chartValues = metricReadings.reversed.map((item) => _numericValue(item['value'])).whereType<double>().toList();
          final double? average = chartValues.isEmpty ? null : chartValues.reduce((a, b) => a + b) / chartValues.length;
          final double? latestNumeric = metricReadings.isEmpty ? null : _numericValue(metricReadings.first['value']);
          final String? trendDirection = chartValues.length < 2
              ? null
              : (chartValues.last > chartValues.first ? 'Upward trend' : (chartValues.last < chartValues.first ? 'Downward trend' : 'Stable trend'));

          return ListView(
            padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
            children: <Widget>[
              PatientHeroCard(badge: '${data.readings.length} readings', title: 'Keep your care team updated between visits', subtitle: 'Log blood pressure, glucose, heart rate, or other manual vitals and review the trend across recent submissions.'),
              const SizedBox(height: 18),
              Row(children: <Widget>[
                Expanded(child: PatientMetricCard(label: 'Recent total', value: '${data.summary['recentReadingCount'] ?? data.readings.length}', caption: 'Readings in the recent window', icon: Icons.monitor_weight_outlined)),
                const SizedBox(width: 12),
                Expanded(child: PatientMetricCard(label: 'Flagged', value: '${data.summary['alertingCount'] ?? 0}', caption: 'Require review', icon: Icons.warning_amber_outlined)),
              ]),
              const SizedBox(height: 18),
              PatientCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text('Trend overview', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 12),
                    if (metrics.isNotEmpty)
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: metrics.map((metric) => ChoiceChip(
                          label: Text(metric),
                          selected: metric == _chartMetric,
                          onSelected: (_) => setState(() => _chartMetric = metric),
                        )).toList(),
                      )
                    else
                      const Text('The graph will appear once at least two numeric readings are available.'),
                    const SizedBox(height: 12),
                    if (chartValues.length < 2)
                      const Text('Add at least two numeric readings for the selected vital to see a trend line.')
                    else ...<Widget>[
                      SizedBox(height: 180, child: _VitalLineChart(values: chartValues)),
                      const SizedBox(height: 12),
                      Row(
                        children: <Widget>[
                          Expanded(child: PatientMetricCard(label: 'Latest', value: latestNumeric?.toStringAsFixed(0) ?? '--', caption: _chartMetric, icon: Icons.stacked_line_chart_outlined)),
                          const SizedBox(width: 12),
                          Expanded(child: PatientMetricCard(label: 'Average', value: average?.toStringAsFixed(0) ?? '--', caption: trendDirection ?? 'Need more readings', icon: Icons.analytics_outlined)),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 18),
              PatientCard(child: Column(children: <Widget>[
                DropdownButtonFormField<String>(
                  initialValue: _metricController.text,
                  decoration: const InputDecoration(labelText: 'Vital type'),
                  items: const <DropdownMenuItem<String>>[
                    DropdownMenuItem(value: 'Blood pressure', child: Text('Blood pressure')),
                    DropdownMenuItem(value: 'Glucose', child: Text('Glucose')),
                    DropdownMenuItem(value: 'Heart rate', child: Text('Heart rate')),
                    DropdownMenuItem(value: 'Weight', child: Text('Weight')),
                    DropdownMenuItem(value: 'Temperature', child: Text('Temperature')),
                  ],
                  onChanged: (String? value) { if (value != null) setState(() => _metricController.text = value); },
                ),
                const SizedBox(height: 12),
                TextField(controller: _valueController, decoration: const InputDecoration(labelText: 'Value (e.g. 128/82 mmHg, 95 mg/dL, 72 bpm)')),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(initialValue: _variant, items: const <DropdownMenuItem<String>>[
                  DropdownMenuItem(value: 'success', child: Text('Normal')),
                  DropdownMenuItem(value: 'info', child: Text('Info')),
                  DropdownMenuItem(value: 'warning', child: Text('Warning')),
                  DropdownMenuItem(value: 'danger', child: Text('Critical')),
                ], onChanged: (String? value) { if (value != null) setState(() => _variant = value); }),
                const SizedBox(height: 12),
                SizedBox(width: double.infinity, child: FilledButton(onPressed: _submitting ? null : _submitReading, child: Text(_submitting ? 'Saving…' : 'Add reading'))),
              ])),
              const SizedBox(height: 18),
              ...sortedReadings.map((Map<String, dynamic> item) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: PatientCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
                  Row(children: <Widget>[
                    Expanded(child: Text(item['metric']?.toString() ?? 'Reading', style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w700))),
                    PatientStatusBadge(label: item['status']?.toString() ?? 'Logged'),
                  ]),
                  const SizedBox(height: 8),
                  Text(item['value']?.toString() ?? '--'),
                  if ((item['time']?.toString() ?? '').isNotEmpty) ...<Widget>[
                    const SizedBox(height: 6),
                    Text(item['time'].toString().replaceFirst('T', ' • ').replaceFirst('.000Z', ' UTC'), style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.textSecondary)),
                  ],
                ])),
              )),
            ],
          );
        },
      ),
    );
  }
}

class _RpmTrendData {
  const _RpmTrendData({required this.summary, required this.readings});
  final Map<String, dynamic> summary;
  final List<Map<String, dynamic>> readings;
}

double? _numericValue(dynamic value) {
  if (value == null) return null;
  final RegExpMatch? match = RegExp(r'(\d+(?:\.\d+)?)').firstMatch(value.toString());
  if (match == null) return null;
  return double.tryParse(match.group(1)!);
}

class _VitalLineChart extends StatelessWidget {
  const _VitalLineChart({required this.values});

  final List<double> values;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: _VitalLineChartPainter(values),
      child: Container(),
    );
  }
}

class _VitalLineChartPainter extends CustomPainter {
  _VitalLineChartPainter(this.values);

  final List<double> values;

  @override
  void paint(Canvas canvas, Size size) {
    if (values.length < 2) return;
    final double minValue = values.reduce((double a, double b) => a < b ? a : b);
    final double maxValue = values.reduce((double a, double b) => a > b ? a : b);
    final double span = (maxValue - minValue).abs() < 0.0001 ? 1 : (maxValue - minValue);

    final Paint axisPaint = Paint()
      ..color = const Color(0xFFE2E8F0)
      ..strokeWidth = 1;
    final Paint linePaint = Paint()
      ..color = AppColors.primaryDark
      ..strokeWidth = 3
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;
    final Paint dotPaint = Paint()..color = AppColors.primaryDark;

    canvas.drawLine(Offset(0, size.height - 1), Offset(size.width, size.height - 1), axisPaint);
    final Path path = Path();
    for (int index = 0; index < values.length; index++) {
      final double dx = size.width * index / (values.length - 1);
      final double normalized = (values[index] - minValue) / span;
      final double dy = size.height - (normalized * (size.height - 16)) - 8;
      if (index == 0) {
        path.moveTo(dx, dy);
      } else {
        path.lineTo(dx, dy);
      }
      canvas.drawCircle(Offset(dx, dy), 3.5, dotPaint);
    }
    canvas.drawPath(path, linePaint);
  }

  @override
  bool shouldRepaint(covariant _VitalLineChartPainter oldDelegate) => oldDelegate.values != values;
}
