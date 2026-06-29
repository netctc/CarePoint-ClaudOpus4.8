import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class OtpDigitBox extends StatelessWidget {
  const OtpDigitBox({
    required this.controller,
    required this.focusNode,
    this.previousFocusNode,
    this.nextFocusNode,
    this.onCompleted,
    super.key,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final FocusNode? previousFocusNode;
  final FocusNode? nextFocusNode;
  final VoidCallback? onCompleted;

  void _handleChanged(String value) {
    final String cleaned = value.replaceAll(RegExp(r'\D'), '');
    if (cleaned != value) {
      controller.text = cleaned.isEmpty ? '' : cleaned.substring(0, 1);
      controller.selection = TextSelection.collapsed(offset: controller.text.length);
    }
    if (controller.text.isNotEmpty) {
      if (nextFocusNode != null) {
        nextFocusNode!.requestFocus();
      } else {
        focusNode.unfocus();
        onCompleted?.call();
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final ColorScheme colors = Theme.of(context).colorScheme;
    return SizedBox(
      width: 48,
      child: TextField(
        controller: controller,
        focusNode: focusNode,
        textAlign: TextAlign.center,
        maxLength: 1,
        keyboardType: TextInputType.number,
        textInputAction: nextFocusNode == null ? TextInputAction.done : TextInputAction.next,
        inputFormatters: <TextInputFormatter>[FilteringTextInputFormatter.digitsOnly],
        style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              fontSize: 24,
              fontWeight: FontWeight.w800,
            ),
        decoration: InputDecoration(
          counterText: '',
          contentPadding: const EdgeInsets.symmetric(vertical: 14),
          filled: true,
          fillColor: colors.surface,
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: BorderSide(color: colors.outline.withOpacity(0.3)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: BorderSide(color: colors.primary, width: 2),
          ),
        ),
        onChanged: _handleChanged,
        onSubmitted: (_) => nextFocusNode == null ? onCompleted?.call() : nextFocusNode!.requestFocus(),
      ),
    );
  }
}
