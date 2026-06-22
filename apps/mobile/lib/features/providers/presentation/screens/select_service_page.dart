import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/state/booking_draft.dart';
import '../../../../core/widgets/app_primary_button.dart';
import '../../../../core/widgets/patient_ui.dart';

class SelectServicePage extends StatefulWidget {
  const SelectServicePage({super.key});

  @override
  State<SelectServicePage> createState() => _SelectServicePageState();
}

class _SelectServicePageState extends State<SelectServicePage> {
  int _selectedIndex = 0;

  List<_ServiceOption> _buildServices(BookingDraft draft) {
    final List<String> source = draft.serviceOptions;
    return List<_ServiceOption>.generate(source.length, (int index) {
      final String title = source[index];
      final bool followUp = title.toLowerCase().contains('follow');
      final bool diagnostic = title.toLowerCase().contains('diagnostic');
      final int amountMinor = diagnostic ? 38000 : (followUp ? 24000 : 32000);
      final String duration = diagnostic ? '40 min' : (followUp ? '20 min' : '30 min');
      final String subtitle = diagnostic
          ? 'Review clinical findings, prior tests, and next steps.'
          : (followUp ? 'Review progress, medications, and home monitoring updates.' : 'Assessment, treatment plan, and follow-up recommendations.');
      return _ServiceOption(
        title: title,
        subtitle: subtitle,
        price: 'SAR ${(amountMinor / 100).toStringAsFixed(2)}',
        duration: duration,
        mode: draft.serviceMode,
        amountMinor: amountMinor,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final BookingDraft draft = BookingDraft.instance;
    final List<_ServiceOption> services = _buildServices(draft);

    return PatientScaffold(
      showNavigation: false,
      showBack: true,
      title: 'Select service',
      subtitle: 'Choose the visit type before location and slot selection.',
      bottomAction: SafeArea(
        minimum: const EdgeInsets.fromLTRB(24, 0, 24, 24),
        child: AppPrimaryButton(
          label: 'Continue to facility / location',
          icon: Icons.arrow_forward,
          onPressed: services.isEmpty
              ? null
              : () {
                  final _ServiceOption selected = services[_selectedIndex];
                  draft.service = selected.title;
                  draft.amountMinor = selected.amountMinor;
                  context.go('/providers/location');
                },
        ),
      ),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(24, 10, 24, 24),
        children: <Widget>[
          PatientHeroCard(
            badge: draft.providerName ?? 'Selected provider',
            title: 'Available services',
            subtitle: 'Only services enabled for the selected provider appear here.',
          ),
          const SizedBox(height: 18),
          ...List<Widget>.generate(services.length, (int index) {
            final _ServiceOption service = services[index];
            final bool selected = index == _selectedIndex;
            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: InkWell(
                borderRadius: BorderRadius.circular(24),
                onTap: () => setState(() => _selectedIndex = index),
                child: PatientCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Row(
                        children: <Widget>[
                          Expanded(child: Text(service.title, style: Theme.of(context).textTheme.titleMedium)),
                          Icon(selected ? Icons.check_circle : Icons.radio_button_unchecked, color: selected ? Colors.green : null),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(service.subtitle, style: Theme.of(context).textTheme.bodyMedium),
                      const SizedBox(height: 14),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: <Widget>[
                          PatientTag(label: service.price, icon: Icons.payments_outlined),
                          PatientTag(label: service.duration, icon: Icons.schedule),
                          PatientTag(label: service.mode, icon: Icons.sync_alt_outlined),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            );
          }),
        ],
      ),
    );
  }
}

class _ServiceOption {
  const _ServiceOption({required this.title, required this.subtitle, required this.price, required this.duration, required this.mode, required this.amountMinor});

  final String title;
  final String subtitle;
  final String price;
  final String duration;
  final String mode;
  final int amountMinor;
}
