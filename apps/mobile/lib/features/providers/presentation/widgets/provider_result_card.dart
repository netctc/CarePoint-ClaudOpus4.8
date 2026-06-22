import 'package:flutter/material.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/widgets/patient_ui.dart';

class ProviderResultCard extends StatelessWidget {
  const ProviderResultCard({
    required this.name,
    required this.specialty,
    required this.serviceMode,
    required this.locations,
    required this.onViewProfile,
    this.nextSlot,
    this.providerType,
    super.key,
  });

  final String name;
  final String specialty;
  final String serviceMode;
  final List<String> locations;
  final String? nextSlot;
  final String? providerType;
  final VoidCallback onViewProfile;

  @override
  Widget build(BuildContext context) {
    return PatientCard(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Container(
                width: 60,
                height: 60,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(colors: <Color>[Color(0xFFE6FAFE), Color(0xFFF4F0FF)]),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Icon(Icons.person_outline_rounded, color: AppColors.primaryDark, size: 30),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(name, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontSize: 18)),
                    const SizedBox(height: 4),
                    Text(specialty, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.textPrimary)),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: <Widget>[
                        if ((providerType ?? '').isNotEmpty) PatientTag(label: providerType!, icon: Icons.badge_outlined),
                        PatientTag(label: serviceMode, icon: Icons.sync_alt_outlined),
                        PatientTag(label: '${locations.length} locations', icon: Icons.location_on_outlined),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.surfaceTint,
              borderRadius: BorderRadius.circular(18),
            ),
            child: Row(
              children: <Widget>[
                const Icon(Icons.schedule_outlined, color: AppColors.primaryDark),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    nextSlot?.isNotEmpty == true ? 'Next availability: $nextSlot' : 'Availability updates after you open the provider workspace.',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.textPrimary),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: locations.take(2).map((String location) => PatientTag(label: location, icon: Icons.place_outlined)).toList(),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton.tonalIcon(
              onPressed: onViewProfile,
              icon: const Icon(Icons.arrow_forward_rounded),
              label: const Text('View provider'),
            ),
          ),
        ],
      ),
    );
  }
}
