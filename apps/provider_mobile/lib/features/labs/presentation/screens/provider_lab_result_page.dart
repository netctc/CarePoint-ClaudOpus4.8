import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/state/provider_session.dart';
import '../../../../core/utils/clinical_routes.dart';
import '../../../../core/utils/json_utils.dart';
import '../../../../core/widgets/provider_ui.dart';

class ProviderLabResultPage extends StatefulWidget {
  const ProviderLabResultPage({required this.resultId, super.key});

  final String resultId;

  @override
  State<ProviderLabResultPage> createState() => _ProviderLabResultPageState();
}

class _ProviderLabResultPageState extends State<ProviderLabResultPage> {
  late Future<Map<String, dynamic>> _future;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _future = ProviderSession.instance.api.labResult(widget.resultId);
  }

  void _refresh() => setState(() => _future = ProviderSession.instance.api.labResult(widget.resultId));

  Future<String?> _captureNote(String title) async {
    final TextEditingController controller = TextEditingController();
    final String? result = await showDialog<String>(
      context: context,
      builder: (BuildContext context) => AlertDialog(
        title: Text(title),
        content: TextField(
          controller: controller,
          maxLines: 4,
          decoration: const InputDecoration(labelText: 'Clinical note (optional)'),
        ),
        actions: <Widget>[
          TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.of(context).pop(controller.text.trim()), child: const Text('Continue')),
        ],
      ),
    );
    controller.dispose();
    return result;
  }

  Future<void> _verifyResult() async {
    final String? note = await _captureNote('Verify lab result');
    if (note == null) return;
    await _runAction(() => ProviderSession.instance.api.verifyLabResult(widget.resultId, note: note), 'Lab result verified.');
  }

  Future<void> _completeSecondReview() async {
    final String? note = await _captureNote('Complete second review');
    if (note == null) return;
    await _runAction(() => ProviderSession.instance.api.secondReviewLabResult(widget.resultId, note: note), 'Second review completed.');
  }

  Future<void> _releaseResult() async {
    final String? note = await _captureNote('Release lab result to chart');
    if (note == null) return;
    await _runAction(() => ProviderSession.instance.api.releaseLabResult(widget.resultId, note: note), 'Lab result released.');
  }

  Future<void> _runAction(Future<Map<String, dynamic>> Function() action, String successMessage) async {
    setState(() => _submitting = true);
    try {
      await action();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(successMessage)));
      _refresh();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString())));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) return const ProviderPage(child: LoadingBlock());
        if (snapshot.hasError) return ProviderPage(child: ErrorStateCard(message: snapshot.error.toString(), onRetry: _refresh));
        final Map<String, dynamic> result = pickMap(snapshot.data, const <String>['item', 'result', 'data']);
        final Map<String, dynamic> releaseReadiness = pickMap(snapshot.data?['releaseReadiness'], const <String>['releaseReadiness']);
        final List<Map<String, dynamic>> values = pickList(result, const <String>['values', 'measurements', 'items']);
        final List<dynamic> comments = result['comments'] is List ? result['comments'] as List<dynamic> : const <dynamic>[];
        final List<Map<String, dynamic>> relatedRecords = pickList(result, const <String>['relatedRecords']);
        final List<dynamic> blockers = releaseReadiness['blockers'] is List ? releaseReadiness['blockers'] as List<dynamic> : const <dynamic>[];
        final bool readyToRelease = readBool(releaseReadiness, const <String>['ready']);

        return SafeArea(
          top: false,
          child: RefreshIndicator(
            onRefresh: () async => _refresh(),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
              children: <Widget>[
                ProviderHeroCard(
                  title: readString(result, const <String>['testName', 'title'], fallback: 'Lab result'),
                  subtitle: readString(result, const <String>['patientName'], fallback: 'Patient'),
                  badge: readString(result, const <String>['status', 'resultStatus'], fallback: 'Available'),
                  trailing: OutlinedButton.icon(
                    onPressed: () => context.go(buildChartRoute(result)),
                    icon: const Icon(Icons.folder_shared_rounded),
                    label: const Text('Patient chart'),
                  ),
                ),
                const SizedBox(height: 20),
                ProviderCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      _InfoRow(label: 'Requested', value: formatDateTimeLabel(readString(result, const <String>['requestedAt'], fallback: ''))),
                      _InfoRow(label: 'Location', value: readString(result, const <String>['location'], fallback: '—')),
                      _InfoRow(label: 'Next step', value: readString(result, const <String>['nextStep'], fallback: '—')),
                      _InfoRow(label: 'Release ready', value: readyToRelease ? 'Yes' : 'Pending checks'),
                      if (readString(releaseReadiness, const <String>['recommendedReviewerRole'], fallback: '').isNotEmpty)
                        _InfoRow(label: 'Reviewer role', value: readString(releaseReadiness, const <String>['recommendedReviewerRole'], fallback: '—')),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                ProviderCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text('Clinical actions', style: Theme.of(context).textTheme.titleMedium),
                      const SizedBox(height: 12),
                      Row(
                        children: <Widget>[
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: _submitting ? null : _verifyResult,
                              icon: const Icon(Icons.verified_outlined),
                              label: const Text('Verify'),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: _submitting ? null : _completeSecondReview,
                              icon: const Icon(Icons.fact_check_outlined),
                              label: const Text('2nd review'),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton.icon(
                          onPressed: _submitting || !readyToRelease ? null : _releaseResult,
                          icon: const Icon(Icons.publish_rounded),
                          label: Text(_submitting ? 'Submitting…' : 'Release result'),
                        ),
                      ),
                      if (blockers.isNotEmpty) ...<Widget>[
                        const SizedBox(height: 12),
                        for (final dynamic blocker in blockers)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: <Widget>[
                                const Padding(
                                  padding: EdgeInsets.only(top: 2),
                                  child: Icon(Icons.error_outline_rounded, size: 18),
                                ),
                                const SizedBox(width: 8),
                                Expanded(child: Text(blocker.toString())),
                              ],
                            ),
                          ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                const SectionTitle(title: 'Measured values'),
                const SizedBox(height: 12),
                if (values.isEmpty)
                  const EmptyStateCard(title: 'No lab measurements returned', subtitle: 'Measurement values will appear here when available.', icon: Icons.biotech_outlined)
                else
                  ...values.map((value) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: ProviderCard(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: <Widget>[
                              Row(
                                children: <Widget>[
                                  Expanded(child: Text(readString(value, const <String>['label', 'name'], fallback: 'Measure'), style: Theme.of(context).textTheme.titleMedium)),
                                  StatusBadge(readString(value, const <String>['flag', 'status'], fallback: 'Normal')),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text(readString(value, const <String>['value'], fallback: '—')),
                              const SizedBox(height: 6),
                              Text('Reference: ${readString(value, const <String>['referenceRange'], fallback: '—')}'),
                            ],
                          ),
                        ),
                      )),
                if (comments.isNotEmpty) ...<Widget>[
                  const SizedBox(height: 8),
                  const SectionTitle(title: 'Clinical comments'),
                  const SizedBox(height: 12),
                  ProviderCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: comments
                          .map((dynamic item) => Padding(
                                padding: const EdgeInsets.only(bottom: 8),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: <Widget>[
                                    const Padding(
                                      padding: EdgeInsets.only(top: 3),
                                      child: Icon(Icons.comment_bank_outlined, size: 18),
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(child: Text(item.toString())),
                                  ],
                                ),
                              ))
                          .toList(),
                    ),
                  ),
                ],
                if (relatedRecords.isNotEmpty) ...<Widget>[
                  const SizedBox(height: 8),
                  const SectionTitle(title: 'Related chart records'),
                  const SizedBox(height: 12),
                  ...relatedRecords.map((record) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: ProviderCard(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: <Widget>[
                              Text(readString(record, const <String>['summary', 'title'], fallback: 'Record'), style: Theme.of(context).textTheme.titleMedium),
                              const SizedBox(height: 4),
                              Text(formatDateTimeLabel(readString(record, const <String>['createdAt'], fallback: ''))),
                            ],
                          ),
                        ),
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

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          SizedBox(width: 110, child: Text(label, style: Theme.of(context).textTheme.bodyMedium)),
          Expanded(child: Text(value, style: Theme.of(context).textTheme.bodyLarge)),
        ],
      ),
    );
  }
}
