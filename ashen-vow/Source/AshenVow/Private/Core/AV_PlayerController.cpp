#include "Core/AV_PlayerController.h"
#include "UI/AV_HUDWidget.h"
#include "UI/AV_DialogueWidget.h"
#include "UI/AV_MemoryThreadJournalWidget.h"
#include "UI/AV_AltarMenuWidget.h"
#include "Characters/AV_NPCBase.h"
#include "Characters/AV_PlayerCharacter.h"
#include "Components/AV_VowComponent.h"
#include "Systems/AV_MemoryThreadSubsystem.h"
#include "Vow/AV_VowTypes.h"
#include "World/AV_AshenAltar.h"
#include "UI/AV_GameHUD.h"
#include "Blueprint/UserWidget.h"

bool AAV_PlayerController::HasDeathScreenWidget() const
{
	return DeathScreenClass != nullptr;
}

bool AAV_PlayerController::IsDialogueWidgetActive() const
{
	return DialogueWidget && DialogueWidget->IsInViewport();
}

void AAV_PlayerController::PushNotification(const FText& Message)
{
	if (HUDWidget)
	{
		HUDWidget->ShowNotification(Message);
	}
	else if (AAV_GameHUD* CanvasHUD = Cast<AAV_GameHUD>(GetHUD()))
	{
		CanvasHUD->PushNotification(Message);
	}
}

void AAV_PlayerController::BeginPlay()
{
	Super::BeginPlay();

	SetUIInputMode(false);

	if (HUDWidgetClass)
	{
		HUDWidget = CreateWidget<UAV_HUDWidget>(this, HUDWidgetClass);
		if (HUDWidget)
		{
			HUDWidget->AddToViewport(0);
		}
	}

	if (UGameInstance* GameInstance = GetGameInstance())
	{
		if (UAV_MemoryThreadSubsystem* Threads = GameInstance->GetSubsystem<UAV_MemoryThreadSubsystem>())
		{
			Threads->OnMemoryThreadAdded.AddDynamic(this, &AAV_PlayerController::HandleMemoryThreadAdded);
		}
	}
}

void AAV_PlayerController::OnPossess(APawn* InPawn)
{
	Super::OnPossess(InPawn);

	if (const AAV_PlayerCharacter* Player = Cast<AAV_PlayerCharacter>(InPawn))
	{
		if (UAV_VowComponent* VowComponent = Player->GetVowComponent())
		{
			VowComponent->OnVowUnlocked.AddUniqueDynamic(this, &AAV_PlayerController::HandleVowUnlocked);
			VowComponent->OnVowEquipped.AddUniqueDynamic(this, &AAV_PlayerController::HandleVowEquipped);
		}
	}
}

// ---------------- Death screen ----------------

void AAV_PlayerController::ShowDeathScreen()
{
	CancelDialogue();
	CloseAltarMenu();
	if (bJournalOpen)
	{
		ToggleJournal();
	}

	if (!DeathScreenWidget && DeathScreenClass)
	{
		DeathScreenWidget = CreateWidget<UUserWidget>(this, DeathScreenClass);
	}
	if (DeathScreenWidget && !DeathScreenWidget->IsInViewport())
	{
		DeathScreenWidget->AddToViewport(10);
	}
	bDeathScreenUp = true;
}

void AAV_PlayerController::HideDeathScreen()
{
	if (DeathScreenWidget && DeathScreenWidget->IsInViewport())
	{
		DeathScreenWidget->RemoveFromParent();
	}
	bDeathScreenUp = false;
}

// ---------------- Dialogue ----------------

void AAV_PlayerController::StartDialogue(AAV_NPCBase* NPC)
{
	if (!NPC || IsUIBlockingGameplay())
	{
		return;
	}

	ActiveDialogueLines = NPC->GetCurrentDialogueLines();
	if (ActiveDialogueLines.Num() == 0)
	{
		return;
	}

	ActiveDialogueNPC = NPC;
	DialogueLineIndex = 0;

	// With a WBP assigned, it displays the session (cursor + clickable Continue).
	// Without one, the canvas HUD draws the panel and F advances — same session.
	if (DialogueWidgetClass)
	{
		if (!DialogueWidget)
		{
			DialogueWidget = CreateWidget<UAV_DialogueWidget>(this, DialogueWidgetClass);
		}
		if (DialogueWidget && !DialogueWidget->IsInViewport())
		{
			DialogueWidget->AddToViewport(5);
		}
		SetUIInputMode(true);
	}

	ProcessCurrentDialogueLine();
}

void AAV_PlayerController::AdvanceDialogue()
{
	if (!ActiveDialogueNPC)
	{
		return;
	}

	++DialogueLineIndex;
	if (DialogueLineIndex >= ActiveDialogueLines.Num())
	{
		EndDialogue();
		return;
	}

	ProcessCurrentDialogueLine();
	if (DialogueWidget)
	{
		DialogueWidget->OnLineChangedBP();
	}
}

void AAV_PlayerController::EndDialogue()
{
	if (!ActiveDialogueNPC)
	{
		return;
	}

	AAV_NPCBase* FinishedNPC = ActiveDialogueNPC;
	ActiveDialogueNPC = nullptr;
	ActiveDialogueLines.Reset();
	DialogueLineIndex = 0;

	if (DialogueWidget && DialogueWidget->IsInViewport())
	{
		DialogueWidget->RemoveFromParent();
	}
	SetUIInputMode(false);

	FinishedNPC->HandleDialogueEnded(Cast<AAV_PlayerCharacter>(GetPawn()));
}

void AAV_PlayerController::CancelDialogue()
{
	if (!ActiveDialogueNPC)
	{
		return;
	}
	ActiveDialogueNPC = nullptr;
	ActiveDialogueLines.Reset();
	DialogueLineIndex = 0;

	if (DialogueWidget && DialogueWidget->IsInViewport())
	{
		DialogueWidget->RemoveFromParent();
	}
	SetUIInputMode(false);
}

void AAV_PlayerController::ProcessCurrentDialogueLine()
{
	if (!ActiveDialogueLines.IsValidIndex(DialogueLineIndex))
	{
		return;
	}

	const FAV_DialogueLine& Line = ActiveDialogueLines[DialogueLineIndex];
	if (Line.MemoryThreadId != NAME_None)
	{
		if (UGameInstance* GameInstance = GetGameInstance())
		{
			if (UAV_MemoryThreadSubsystem* Threads = GameInstance->GetSubsystem<UAV_MemoryThreadSubsystem>())
			{
				Threads->AddEntry(Line.MemoryThreadId, Line.MemoryThreadText);
			}
		}
	}
}

FText AAV_PlayerController::GetCurrentDialogueSpeaker() const
{
	if (!ActiveDialogueLines.IsValidIndex(DialogueLineIndex))
	{
		return FText::GetEmpty();
	}
	const FAV_DialogueLine& Line = ActiveDialogueLines[DialogueLineIndex];
	if (!Line.SpeakerNameOverride.IsEmpty())
	{
		return Line.SpeakerNameOverride;
	}
	return ActiveDialogueNPC ? ActiveDialogueNPC->GetNpcDisplayName() : FText::GetEmpty();
}

FText AAV_PlayerController::GetCurrentDialogueLineText() const
{
	return ActiveDialogueLines.IsValidIndex(DialogueLineIndex)
		? ActiveDialogueLines[DialogueLineIndex].Text
		: FText::GetEmpty();
}

// ---------------- Altar menu ----------------

void AAV_PlayerController::OpenAltarMenu(AAV_AshenAltar* Altar)
{
	if (!Altar || !AltarMenuWidgetClass || IsUIBlockingGameplay())
	{
		return;
	}

	MenuAltar = Altar;
	if (!AltarMenuWidget)
	{
		AltarMenuWidget = CreateWidget<UAV_AltarMenuWidget>(this, AltarMenuWidgetClass);
	}
	if (AltarMenuWidget && !AltarMenuWidget->IsInViewport())
	{
		AltarMenuWidget->AddToViewport(5);
	}
	SetUIInputMode(true);
}

void AAV_PlayerController::CloseAltarMenu()
{
	if (!MenuAltar)
	{
		return;
	}
	MenuAltar = nullptr;
	if (AltarMenuWidget && AltarMenuWidget->IsInViewport())
	{
		AltarMenuWidget->RemoveFromParent();
	}
	SetUIInputMode(false);
}

// ---------------- Journal ----------------

void AAV_PlayerController::ToggleJournal()
{
	// The journal yields to dialogue, altar menu, and death.
	if (!bJournalOpen && (ActiveDialogueNPC || MenuAltar || bDeathScreenUp))
	{
		return;
	}

	if (bJournalOpen)
	{
		if (JournalWidget && JournalWidget->IsInViewport())
		{
			JournalWidget->RemoveFromParent();
		}
		bJournalOpen = false;
		SetUIInputMode(false);
		return;
	}

	if (!JournalWidgetClass)
	{
		return;
	}
	if (!JournalWidget)
	{
		JournalWidget = CreateWidget<UAV_MemoryThreadJournalWidget>(this, JournalWidgetClass);
	}
	if (JournalWidget)
	{
		JournalWidget->AddToViewport(5);
		bJournalOpen = true;
		SetUIInputMode(true);
	}
}

// ---------------- Shared UI state ----------------

bool AAV_PlayerController::IsUIBlockingGameplay() const
{
	return ActiveDialogueNPC != nullptr || MenuAltar != nullptr || bJournalOpen || bDeathScreenUp;
}

void AAV_PlayerController::SetUIInputMode(bool bUIOpen)
{
	if (bUIOpen)
	{
		// GameAndUI keeps Tab/F flowing to the pawn while buttons stay clickable;
		// the pawn itself ignores combat input via IsUIBlockingGameplay().
		FInputModeGameAndUI InputMode;
		InputMode.SetHideCursorDuringCapture(false);
		SetInputMode(InputMode);
		bShowMouseCursor = true;
	}
	else
	{
		SetInputMode(FInputModeGameOnly());
		bShowMouseCursor = false;
	}
}

// ---------------- Notifications ----------------

void AAV_PlayerController::HandleMemoryThreadAdded(const FAV_MemoryThreadEntry& Entry)
{
	PushNotification(FText::Format(
		NSLOCTEXT("AshenVow", "ThreadToast", "Memory Thread — {0}"), Entry.Text));
}

void AAV_PlayerController::HandleVowUnlocked(const FAV_VowDefinition& Vow)
{
	PushNotification(FText::Format(
		NSLOCTEXT("AshenVow", "VowUnlockToast", "Vow fragment found: {0}"), Vow.DisplayName));
}

void AAV_PlayerController::HandleVowEquipped(const FAV_VowDefinition& Vow)
{
	PushNotification(FText::Format(
		NSLOCTEXT("AshenVow", "VowEquipToast", "Vow sworn: {0}"), Vow.DisplayName));
}
