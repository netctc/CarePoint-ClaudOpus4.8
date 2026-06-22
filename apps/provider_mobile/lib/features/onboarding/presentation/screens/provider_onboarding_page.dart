import 'package:flutter/material.dart';

import '../../../../core/state/provider_session.dart';
import '../../../../core/utils/json_utils.dart';
import '../../../../core/widgets/provider_ui.dart';

class ProviderOnboardingPage extends StatefulWidget {
  const ProviderOnboardingPage({super.key});

  @override
  State<ProviderOnboardingPage> createState() => _ProviderOnboardingPageState();
}

class _ProviderOnboardingPageState extends State<ProviderOnboardingPage> {
  late Future<Map<String, dynamic>> _future;
  final TextEditingController _orgNameController = TextEditingController();
  String _hspModel = 'INSTITUTIONAL';
  final TextEditingController _primaryFacilityController = TextEditingController();
  final TextEditingController _licenseNumberController = TextEditingController();
  String _crossFacilityAccess = 'NONE';
  final TextEditingController _facilityAccessNoteController = TextEditingController();
  final TextEditingController _payoutAccountController = TextEditingController();

  bool _telehealthAgreement = false;
  bool _privacyAgreement = false;
  bool _payoutOwnership = false;
  bool _saving = false;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  @override
  void dispose() {
    _orgNameController.dispose();
    _primaryFacilityController.dispose();
    _licenseNumberController.dispose();
    _facilityAccessNoteController.dispose();
    _payoutAccountController.dispose();
    super.dispose();
  }

  Future<Map<String, dynamic>> _load() async {
    final Map<String, dynamic> response = await ProviderSession.instance.api.onboardingMe();
    final Map<String, dynamic> item = pickMap(response, const <String>['item', 'data']);
    _orgNameController.text = readString(item, const <String>['orgName'], fallback: '');
    _hspModel = readString(item, const <String>['hspModel'], fallback: 'INSTITUTIONAL');
    _primaryFacilityController.text = readString(item, const <String>['primaryFacility'], fallback: '');
    _crossFacilityAccess = readString(item, const <String>['crossFacilityAccess'], fallback: 'NONE');
    _facilityAccessNoteController.text = readString(item, const <String>['facilityAccessNote'], fallback: '');
    _licenseNumberController.text = readString(item, const <String>['licenseNumber'], fallback: '');
    _payoutAccountController.text = readString(item, const <String>['payoutAccount'], fallback: '');
    final Map<String, dynamic> attestations = pickMap(item, const <String>['attestations']);
    _telehealthAgreement = readBool(attestations, const <String>['telehealthAgreement']);
    _privacyAgreement = readBool(attestations, const <String>['privacyAgreement']);
    _payoutOwnership = readBool(attestations, const <String>['payoutOwnership']);
    return response;
  }

  void _refresh() {
    setState(() => _future = _load());
  }

  Map<String, dynamic> _payload() {
    return <String, dynamic>{
      'orgName': _orgNameController.text.trim(),
      'hspModel': _hspModel,
      'primaryFacility': _primaryFacilityController.text.trim(),
      'crossFacilityAccess': _crossFacilityAccess,
      'facilityAccessNote': _facilityAccessNoteController.text.trim(),
      'licenseNumber': _licenseNumberController.text.trim(),
      'payoutAccount': _payoutAccountController.text.trim(),
      'checklist': <Map<String, dynamic>>[
        <String, dynamic>{
          'label': 'License verification',
          'detail': 'Validate active professional license and specialization.',
          'status': _licenseNumberController.text.trim().isNotEmpty ? 'Ready' : 'Missing',
          'variant': _licenseNumberController.text.trim().isNotEmpty ? 'success' : 'warning',
        },
        <String, dynamic>{
          'label': 'Facility assignment',
          'detail': 'Confirm the primary facility and service channels.',
          'status': _primaryFacilityController.text.trim().isNotEmpty ? 'Ready' : 'Pending',
          'variant': _primaryFacilityController.text.trim().isNotEmpty ? 'success' : 'info',
        },
        <String, dynamic>{
          'label': 'Payout setup',
          'detail': 'Capture bank payout ownership confirmation.',
          'status': _payoutOwnership ? 'Confirmed' : 'Pending',
          'variant': _payoutOwnership ? 'success' : 'warning',
        },
      ],
      'attestations': <String, dynamic>{
        'telehealthAgreement': _telehealthAgreement,
        'privacyAgreement': _privacyAgreement,
        'payoutOwnership': _payoutOwnership,
      },
    };
  }

  bool _validate() {
    if (_orgNameController.text.trim().length < 2 ||
        _primaryFacilityController.text.trim().length < 2 ||
        _licenseNumberController.text.trim().length < 2) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Complete the organization, facility, and license fields.')));
      return false;
    }
    return true;
  }

  Future<void> _saveDraft() async {
    if (!_validate()) return;
    setState(() => _saving = true);
    try {
      await ProviderSession.instance.api.saveOnboardingDraft(_payload());
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Onboarding draft saved.')));
      _refresh();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString())));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _submit() async {
    if (!_validate()) return;
    if (!_telehealthAgreement || !_privacyAgreement || !_payoutOwnership) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('All attestations must be accepted before submission.')));
      return;
    }
    setState(() => _submitting = true);
    try {
      await ProviderSession.instance.api.submitOnboarding(_payload());
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Onboarding submitted for review.')));
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
      builder: (BuildContext context, AsyncSnapshot<Map<String, dynamic>> snapshot) {
        if (snapshot.connectionState != ConnectionState.done) return const ProviderPage(child: LoadingBlock());
        if (snapshot.hasError) return ProviderPage(child: ErrorStateCard(message: snapshot.error.toString(), onRetry: _refresh));

        final Map<String, dynamic> item = pickMap(snapshot.data, const <String>['item', 'data']);
        final List<Map<String, dynamic>> checklist = pickList(item, const <String>['checklist']);

        return SafeArea(
          top: false,
          child: RefreshIndicator(
            onRefresh: () async => _refresh(),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
              children: <Widget>[
                ProviderHeroCard(
                  title: 'Provider onboarding',
                  subtitle: 'Complete provider credentials, facility assignment, and compliance attestations from mobile.',
                  badge: readString(item, const <String>['status'], fallback: 'Draft'),
                  trailing: Wrap(
                    spacing: 12,
                    runSpacing: 12,
                    children: <Widget>[
                      OutlinedButton.icon(
                        onPressed: _saving || _submitting ? null : _saveDraft,
                        icon: const Icon(Icons.save_outlined),
                        label: Text(_saving ? 'Saving…' : 'Save draft'),
                      ),
                      FilledButton.icon(
                        onPressed: _saving || _submitting ? null : _submit,
                        icon: const Icon(Icons.check_circle_outline_rounded),
                        label: Text(_submitting ? 'Submitting…' : 'Submit'),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                ProviderCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text('Profile and credential details', style: Theme.of(context).textTheme.titleMedium),
                      const SizedBox(height: 16),
                      TextField(
                        controller: _orgNameController,
                        decoration: const InputDecoration(labelText: 'Organization name'),
                      ),
                      const SizedBox(height: 12),
                      DropdownButtonFormField<String>(
                        value: _hspModel,
                        decoration: const InputDecoration(labelText: 'HSP account model'),
                        items: const <DropdownMenuItem<String>>[
                          DropdownMenuItem(value: 'INDIVIDUAL', child: Text('Individual HSP')),
                          DropdownMenuItem(value: 'INSTITUTIONAL', child: Text('Institutional HSP')),
                          DropdownMenuItem(value: 'ORGANIZATION_BASED', child: Text('Organization-based HSP')),
                        ],
                        onChanged: (String? value) => setState(() => _hspModel = value ?? 'INSTITUTIONAL'),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _primaryFacilityController,
                        decoration: const InputDecoration(labelText: 'Primary facility'),
                      ),
                      const SizedBox(height: 12),
                      DropdownButtonFormField<String>(
                        value: _crossFacilityAccess,
                        decoration: const InputDecoration(labelText: 'Cross-facility access'),
                        items: const <DropdownMenuItem<String>>[
                          DropdownMenuItem(value: 'NONE', child: Text('No external facility access')),
                          DropdownMenuItem(value: 'LIMITED', child: Text('Limited access by explicit consent')),
                          DropdownMenuItem(value: 'FULL', child: Text('Full access by explicit consent')),
                        ],
                        onChanged: (String? value) => setState(() => _crossFacilityAccess = value ?? 'NONE'),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _facilityAccessNoteController,
                        decoration: const InputDecoration(labelText: 'Facility access note'),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _licenseNumberController,
                        decoration: const InputDecoration(labelText: 'License number'),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _payoutAccountController,
                        decoration: const InputDecoration(labelText: 'Payout account (optional)'),
                      ),
                      const SizedBox(height: 12),
                      Text('Submitted: ${formatDateTimeLabel(item['submittedAt'])}', style: Theme.of(context).textTheme.bodySmall),
                      const SizedBox(height: 4),
                      Text('Reviewed: ${formatDateTimeLabel(item['reviewedAt'])}', style: Theme.of(context).textTheme.bodySmall),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                ProviderCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text('Attestations', style: Theme.of(context).textTheme.titleMedium),
                      const SizedBox(height: 8),
                      CheckboxListTile(
                        value: _telehealthAgreement,
                        onChanged: (bool? value) => setState(() => _telehealthAgreement = value ?? false),
                        contentPadding: EdgeInsets.zero,
                        title: const Text('Telehealth agreement accepted'),
                      ),
                      CheckboxListTile(
                        value: _privacyAgreement,
                        onChanged: (bool? value) => setState(() => _privacyAgreement = value ?? false),
                        contentPadding: EdgeInsets.zero,
                        title: const Text('Privacy and data handling agreement accepted'),
                      ),
                      CheckboxListTile(
                        value: _payoutOwnership,
                        onChanged: (bool? value) => setState(() => _payoutOwnership = value ?? false),
                        contentPadding: EdgeInsets.zero,
                        title: const Text('Payout account ownership confirmed'),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                const SectionTitle(title: 'Checklist'),
                const SizedBox(height: 12),
                if (checklist.isEmpty)
                  const EmptyStateCard(
                    title: 'No checklist items',
                    subtitle: 'Checklist status will appear once onboarding data is loaded.',
                    icon: Icons.fact_check_outlined,
                  )
                else
                  ...checklist.map((Map<String, dynamic> entry) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: ProviderCard(
                          child: Row(
                            children: <Widget>[
                              const CircleAvatar(child: Icon(Icons.assignment_turned_in_outlined)),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: <Widget>[
                                    Text(readString(entry, const <String>['label'], fallback: 'Checklist item'), style: Theme.of(context).textTheme.titleMedium),
                                    const SizedBox(height: 4),
                                    Text(readString(entry, const <String>['detail'], fallback: 'No detail provided')),
                                  ],
                                ),
                              ),
                              StatusBadge(readString(entry, const <String>['status'], fallback: 'Pending')),
                            ],
                          ),
                        ),
                      )),
                if (readString(item, const <String>['decisionNote'], fallback: '').isNotEmpty && readString(item, const <String>['decisionNote'], fallback: '') != '—') ...<Widget>[
                  const SizedBox(height: 20),
                  ProviderCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Text('Reviewer note', style: Theme.of(context).textTheme.titleMedium),
                        const SizedBox(height: 8),
                        Text(readString(item, const <String>['decisionNote'], fallback: '')),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}
