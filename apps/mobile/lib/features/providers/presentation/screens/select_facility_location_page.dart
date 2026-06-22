import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/state/booking_draft.dart';
import '../../../../core/widgets/app_primary_button.dart';
import '../../../../core/widgets/patient_ui.dart';

class SelectFacilityLocationPage extends StatefulWidget {
  const SelectFacilityLocationPage({super.key});

  @override
  State<SelectFacilityLocationPage> createState() => _SelectFacilityLocationPageState();
}

class _SelectFacilityLocationPageState extends State<SelectFacilityLocationPage> {
  int _selectedIndex = 0;

  List<_FacilityOption> _buildOptions(BookingDraft draft) {
    final List<String> locations = draft.locationOptions;
    return List<_FacilityOption>.generate(locations.length, (int index) {
      final String location = locations[index];
      final bool isVirtual = location.toLowerCase().contains('virtual') || location.toLowerCase().contains('online');
      return _FacilityOption(
        title: location,
        subtitle: isVirtual ? 'Available across Saudi Arabia' : 'Selected provider location',
        details: isVirtual ? 'Online consultation without travel' : 'In-person care delivery with facility support',
        mode: isVirtual ? 'Online' : 'In-Person',
        appointmentType: isVirtual ? 'ONLINE_MEETING' : 'IN_PERSON_VISIT',
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final BookingDraft draft = BookingDraft.instance;
    final List<_FacilityOption> options = _buildOptions(draft);

    return PatientScaffold(
      showNavigation: false,
      showBack: true,
      title: 'Select visit type',
      subtitle: 'Choose whether the visit is online or in person, then continue to slot selection.',
      bottomAction: SafeArea(
        minimum: const EdgeInsets.fromLTRB(24, 0, 24, 24),
        child: AppPrimaryButton(
          label: 'Continue to slot selection',
          icon: Icons.arrow_forward,
          onPressed: options.isEmpty
              ? null
              : () {
                  draft.location = options[_selectedIndex].title;
                  draft.appointmentType = options[_selectedIndex].appointmentType;
                  context.go('/booking/slot');
                },
        ),
      ),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(24, 10, 24, 24),
        children: <Widget>[
          PatientHeroCard(
            badge: draft.service,
            title: 'Facility & care mode',
            subtitle: 'Your selection determines the appointment type saved with the booking.',
          ),
          const SizedBox(height: 18),
          ...List<Widget>.generate(options.length, (int index) {
            final _FacilityOption option = options[index];
            final bool selected = index == _selectedIndex;
            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: InkWell(
                borderRadius: BorderRadius.circular(24),
                onTap: () => setState(() => _selectedIndex = index),
                child: PatientCard(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(color: selected ? const Color(0xFFE6FAFE) : const Color(0xFFF8FBFD), borderRadius: BorderRadius.circular(16)),
                        child: Icon(option.mode == 'Online' ? Icons.videocam_outlined : Icons.location_on_outlined),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            Row(
                              children: <Widget>[
                                Expanded(child: Text(option.title, style: Theme.of(context).textTheme.titleMedium)),
                                Icon(selected ? Icons.check_circle : Icons.radio_button_unchecked, color: selected ? Colors.green : null),
                              ],
                            ),
                            const SizedBox(height: 6),
                            Text(option.subtitle, style: Theme.of(context).textTheme.bodyLarge),
                            const SizedBox(height: 4),
                            Text(option.details, style: Theme.of(context).textTheme.bodyMedium),
                            const SizedBox(height: 10),
                            PatientTag(label: option.mode, icon: Icons.sync_alt_outlined),
                          ],
                        ),
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

class _FacilityOption {
  const _FacilityOption({required this.title, required this.subtitle, required this.details, required this.mode, required this.appointmentType});

  final String title;
  final String subtitle;
  final String details;
  final String mode;
  final String appointmentType;
}
