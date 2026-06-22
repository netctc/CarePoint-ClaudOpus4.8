import 'package:flutter/material.dart';

import '../../../../core/state/provider_session.dart';
import '../../../../core/utils/json_utils.dart';
import '../../../../core/widgets/app_primary_button.dart';
import '../../../../core/widgets/provider_ui.dart';

class ProviderFacilityDetailPage extends StatefulWidget {
  const ProviderFacilityDetailPage({required this.facilityId, super.key});

  final String facilityId;

  @override
  State<ProviderFacilityDetailPage> createState() => _ProviderFacilityDetailPageState();
}

class _ProviderFacilityDetailPageState extends State<ProviderFacilityDetailPage> {
  late Future<Map<String, dynamic>> _future;

  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _addressController = TextEditingController();
  final TextEditingController _serviceModesController = TextEditingController();
  final TextEditingController _matrixController = TextEditingController();

  String _publishStatus = 'DRAFT';
  bool _loadedInitialValues = false;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _future = ProviderSession.instance.api.settingsFacilityDetail(widget.facilityId);
  }

  @override
  void dispose() {
    _nameController.dispose();
    _addressController.dispose();
    _serviceModesController.dispose();
    _matrixController.dispose();
    super.dispose();
  }

  void _refresh() {
    setState(() {
      _loadedInitialValues = false;
      _future = ProviderSession.instance.api.settingsFacilityDetail(widget.facilityId);
    });
  }

  void _applyInitialValues(Map<String, dynamic> item) {
    if (_loadedInitialValues) return;
    _loadedInitialValues = true;
    _nameController.text = readString(item, const <String>['name'], fallback: '');
    _addressController.text = readString(item, const <String>['address'], fallback: '');
    final String status = readString(item, const <String>['publishStatus', 'status'], fallback: 'DRAFT').toUpperCase();
    _publishStatus = const <String>['DRAFT', 'INTERNAL', 'PUBLISHED', 'RESTRICTED'].contains(status) ? status : 'DRAFT';
    final List<dynamic> serviceModes = item['serviceModes'] is List ? item['serviceModes'] as List<dynamic> : const <dynamic>[];
    _serviceModesController.text = serviceModes.map((dynamic item) => item.toString().trim()).where((String item) => item.isNotEmpty).join(', ');
    final List<Map<String, dynamic>> matrix = pickList(item, const <String>['serviceMatrix']);
    _matrixController.text = matrix
        .map((Map<String, dynamic> row) => [
              readString(row, const <String>['service'], fallback: ''),
              readString(row, const <String>['channel'], fallback: ''),
              readString(row, const <String>['price'], fallback: ''),
              readString(row, const <String>['effectiveDate'], fallback: ''),
            ].join('|'))
        .join('\n');
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final List<String> serviceModes = _serviceModesController.text
          .split(',')
          .map((String item) => item.trim())
          .where((String item) => item.isNotEmpty)
          .toList();
      final List<Map<String, dynamic>> matrix = _matrixController.text
          .split('\n')
          .map((String line) => line.trim())
          .where((String line) => line.isNotEmpty)
          .map((String line) {
            final List<String> columns = line.split('|').map((String item) => item.trim()).toList();
            return <String, dynamic>{
              'service': columns.isNotEmpty ? columns[0] : '',
              'channel': columns.length > 1 ? columns[1] : '',
              'price': columns.length > 2 ? columns[2] : '',
              'effectiveDate': columns.length > 3 ? columns[3] : '',
            };
          })
          .toList();

      await ProviderSession.instance.api.updateFacility(widget.facilityId, <String, dynamic>{
        'name': _nameController.text.trim(),
        'address': _addressController.text.trim(),
        'serviceModes': serviceModes,
        'publishStatus': _publishStatus,
        'serviceMatrix': matrix,
      });

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Facility settings saved.')));
      _refresh();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString())));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (BuildContext context, AsyncSnapshot<Map<String, dynamic>> snapshot) {
        if (snapshot.connectionState != ConnectionState.done) return const ProviderPage(child: LoadingBlock());
        if (snapshot.hasError) return ProviderPage(child: ErrorStateCard(message: snapshot.error.toString(), onRetry: _refresh));

        final Map<String, dynamic> item = pickMap(snapshot.data, const <String>['item', 'facility', 'data']);
        _applyInitialValues(item);

        return SafeArea(
          top: false,
          child: RefreshIndicator(
            onRefresh: () async => _refresh(),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
              children: <Widget>[
                ProviderHeroCard(
                  title: readString(item, const <String>['name'], fallback: 'Facility settings'),
                  subtitle: 'Edit facility profile, service modes, and the mobile-visible service matrix used by provider operations.',
                  badge: readString(item, const <String>['publishStatus', 'status'], fallback: 'Configured'),
                ),
                const SizedBox(height: 20),
                ProviderCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      TextField(
                        controller: _nameController,
                        decoration: const InputDecoration(labelText: 'Facility name'),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _addressController,
                        decoration: const InputDecoration(labelText: 'Address'),
                        minLines: 2,
                        maxLines: 3,
                      ),
                      const SizedBox(height: 12),
                      DropdownButtonFormField<String>(
                        initialValue: _publishStatus,
                        decoration: const InputDecoration(labelText: 'Publish status'),
                        items: const <String>['DRAFT', 'INTERNAL', 'PUBLISHED', 'RESTRICTED']
                            .map((String value) => DropdownMenuItem<String>(value: value, child: Text(value)))
                            .toList(),
                        onChanged: (String? value) {
                          if (value != null) setState(() => _publishStatus = value);
                        },
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _serviceModesController,
                        decoration: const InputDecoration(
                          labelText: 'Service modes',
                          helperText: 'Comma-separated values such as In-person, Virtual, Home visit',
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _matrixController,
                        minLines: 5,
                        maxLines: 8,
                        decoration: const InputDecoration(
                          labelText: 'Service matrix',
                          helperText: 'One row per line using: service|channel|price|effectiveDate',
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                AppPrimaryButton(
                  label: _saving ? 'Saving…' : 'Save facility settings',
                  icon: Icons.save_rounded,
                  onPressed: _saving ? null : _save,
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
