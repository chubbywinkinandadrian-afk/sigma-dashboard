#include "UI/AV_DialogueWidget.h"
#include "Core/AV_PlayerController.h"

FText UAV_DialogueWidget::GetSpeakerName() const
{
	const AAV_PlayerController* PC = Cast<AAV_PlayerController>(GetOwningPlayer());
	return PC ? PC->GetCurrentDialogueSpeaker() : FText::GetEmpty();
}

FText UAV_DialogueWidget::GetLineText() const
{
	const AAV_PlayerController* PC = Cast<AAV_PlayerController>(GetOwningPlayer());
	return PC ? PC->GetCurrentDialogueLineText() : FText::GetEmpty();
}

void UAV_DialogueWidget::Advance()
{
	if (AAV_PlayerController* PC = Cast<AAV_PlayerController>(GetOwningPlayer()))
	{
		PC->AdvanceDialogue();
	}
}
