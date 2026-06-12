#include "UI/AV_GameHUD.h"
#include "Characters/AV_PlayerCharacter.h"
#include "Characters/AV_EnemyBase.h"
#include "EngineUtils.h"
#include "Components/AV_HealthComponent.h"
#include "Components/AV_StaminaComponent.h"
#include "Components/AV_LockOnComponent.h"
#include "Components/AV_InteractionComponent.h"
#include "Components/AV_VowComponent.h"
#include "Interfaces/AV_Targetable.h"
#include "Core/AV_PlayerController.h"
#include "Engine/Canvas.h"
#include "Engine/Engine.h"
#include "Engine/Font.h"

void AAV_GameHUD::DrawHUD()
{
	Super::DrawHUD();

	const AAV_PlayerCharacter* Player = Cast<AAV_PlayerCharacter>(GetOwningPawn());
	if (!Player || !Canvas)
	{
		return;
	}

	const AAV_PlayerController* PC = Cast<AAV_PlayerController>(GetOwningPlayerController());
	const bool bUMGHudActive = PC && PC->GetHUDWidget() != nullptr;

	UFont* Small = GEngine->GetSmallFont();
	UFont* Medium = GEngine->GetMediumFont();
	UFont* Large = GEngine->GetLargeFont();

	if (!Player->IsAlive())
	{
		if (!PC || !PC->HasDeathScreenWidget())
		{
			DrawDeathOverlay();
		}
		return;
	}

	DrawDamageFlash(Player->GetHealthComponent()->GetCurrentHealth());
	DrawEnemyHealthBars();

	if (!bUMGHudActive)
	{
		// Top-left vitals: health, stamina, Vow Energy.
		DrawBar(40.f, 40.f, 380.f, 16.f, Player->GetHealthComponent()->GetHealthPercent(), HealthColor);
		DrawBar(40.f, 62.f, 300.f, 11.f, Player->GetStaminaComponent()->GetStaminaPercent(), StaminaColor);
		DrawBar(40.f, 79.f, 240.f, 8.f, Player->GetVowComponent()->GetEnergyPercent(), VowEnergyColor);
		DrawVowStatus(Player);

		const FString FlaskText = FString::Printf(TEXT("Ashen Flask  %d / %d"),
			Player->GetFlaskCharges(), Player->GetMaxFlaskCharges());
		DrawText(FlaskText, TextColor, 40.f, 96.f, Medium);

		// Ash counter, bottom-right.
		const FString AshText = FString::Printf(TEXT("Ash  %d"), Player->GetAshCount());
		float AshW, AshH;
		GetTextSize(AshText, AshW, AshH, Medium);
		DrawText(AshText, TextColor, Canvas->SizeX - AshW - 48.f, Canvas->SizeY - AshH - 44.f, Medium);

		// Interaction prompt, lower center — large, with a backing panel for
		// readability. Hidden while a dialogue session owns the F key.
		const bool bInDialogue = PC && PC->IsInDialogue();
		const FText Prompt = Player->IsResting()
			? NSLOCTEXT("AshenVow", "RisePrompt", "Rise")
			: Player->GetInteractionComponent()->GetFocusedPromptText();
		if (!Prompt.IsEmpty() && !bInDialogue)
		{
			const FString PromptText = FString::Printf(TEXT("[F]  %s"), *Prompt.ToString());
			const float PromptScale = 1.4f;
			float PromptW, PromptH;
			GetTextSize(PromptText, PromptW, PromptH, Large, PromptScale);
			const float PromptX = Canvas->SizeX * 0.5f;
			const float PromptY = Canvas->SizeY * 0.76f;
			DrawRect(FLinearColor(0.f, 0.f, 0.f, 0.55f),
				PromptX - PromptW * 0.5f - 18.f, PromptY - 10.f, PromptW + 36.f, PromptH + 20.f);
			DrawCenteredText(PromptText, PromptX, PromptY, TextColor, Large, PromptScale);
		}
	}

	// Lock-on reticle (drawn even with UMG active until the WBP adds its own).
	if (AActor* Target = Player->GetLockOnComponent()->GetCurrentTarget())
	{
		if (Target->Implements<UAV_Targetable>())
		{
			const FVector Projected = Project(IAV_Targetable::Execute_GetTargetPoint(Target));
			if (Projected.Z > 0.f) // in front of the camera
			{
				const float Size = 7.f;
				const FLinearColor Reticle(0.9f, 0.85f, 0.7f);
				DrawLine(Projected.X - Size, Projected.Y, Projected.X, Projected.Y - Size, Reticle, 2.f);
				DrawLine(Projected.X, Projected.Y - Size, Projected.X + Size, Projected.Y, Reticle, 2.f);
				DrawLine(Projected.X + Size, Projected.Y, Projected.X, Projected.Y + Size, Reticle, 2.f);
				DrawLine(Projected.X, Projected.Y + Size, Projected.X - Size, Projected.Y, Reticle, 2.f);
			}
		}
	}

	// Dialogue panel (canvas fallback) and the resting Vow-selection list.
	if (PC && PC->IsInDialogue() && !PC->IsDialogueWidgetActive())
	{
		DrawDialoguePanel(PC);
	}
	else if (!bUMGHudActive && Player->IsResting() && (!PC || !PC->GetMenuAltar()))
	{
		DrawRestingVowList(Player);
	}

	DrawNotifications();
}

void AAV_GameHUD::DrawBar(float X, float Y, float Width, float Height, float Percent, const FLinearColor& FillColor)
{
	DrawRect(BarBackColor, X - 2.f, Y - 2.f, Width + 4.f, Height + 4.f);
	DrawRect(FillColor, X, Y, Width * FMath::Clamp(Percent, 0.f, 1.f), Height);
}

void AAV_GameHUD::DrawCenteredText(const FString& Text, float CenterX, float Y, const FLinearColor& Color, UFont* Font, float Scale)
{
	float TextW, TextH;
	GetTextSize(Text, TextW, TextH, Font, Scale);
	DrawText(Text, Color, CenterX - TextW * 0.5f, Y, Font, Scale);
}

void AAV_GameHUD::DrawDeathOverlay()
{
	DrawRect(FLinearColor(0.f, 0.f, 0.f, 0.75f), 0.f, 0.f, Canvas->SizeX, Canvas->SizeY);
	DrawCenteredText(TEXT("YOU ARE FORGOTTEN"),
		Canvas->SizeX * 0.5f, Canvas->SizeY * 0.45f,
		FLinearColor(0.78f, 0.74f, 0.66f), GEngine->GetLargeFont(), 2.2f);
}

void AAV_GameHUD::DrawEnemyHealthBars()
{
	const APawn* OwnerPawn = GetOwningPawn();
	UWorld* World = GetWorld();
	if (!OwnerPawn || !World)
	{
		return;
	}

	for (TActorIterator<AAV_EnemyBase> It(World); It; ++It)
	{
		AAV_EnemyBase* Enemy = *It;
		const UAV_HealthComponent* Health = Enemy->GetHealthComponent();
		if (!Enemy->IsAlive() || !Health)
		{
			continue;
		}
		if (FVector::DistSquared(OwnerPawn->GetActorLocation(), Enemy->GetActorLocation()) > FMath::Square(3000.f))
		{
			continue;
		}

		// Show only once the enemy matters: aggroed, or already wounded.
		const EAV_EnemyState State = Enemy->GetEnemyState();
		const bool bAggroed = State == EAV_EnemyState::Chase || State == EAV_EnemyState::Combat;
		const bool bWounded = Health->GetCurrentHealth() < Health->GetMaxHealth();
		if (!bAggroed && !bWounded)
		{
			continue;
		}

		const FVector HeadPoint = Enemy->GetActorLocation() + FVector(0.f, 0.f, 110.f);
		const FVector Projected = Project(HeadPoint);
		if (Projected.Z <= 0.f)
		{
			continue; // behind the camera
		}

		const float BarWidth = 95.f;
		const float BarHeight = 7.f;
		DrawRect(BarBackColor, Projected.X - BarWidth * 0.5f - 1.f, Projected.Y - 1.f, BarWidth + 2.f, BarHeight + 2.f);
		DrawRect(FLinearColor(0.55f, 0.10f, 0.07f),
			Projected.X - BarWidth * 0.5f, Projected.Y, BarWidth * Health->GetHealthPercent(), BarHeight);
	}
}

void AAV_GameHUD::DrawDamageFlash(float CurrentHealth)
{
	if (LastSeenPlayerHealth > 0.f && CurrentHealth < LastSeenPlayerHealth)
	{
		DamageFlashAlpha = 0.38f;
	}
	LastSeenPlayerHealth = CurrentHealth;

	if (DamageFlashAlpha > 0.f)
	{
		DrawRect(FLinearColor(0.45f, 0.02f, 0.02f, DamageFlashAlpha), 0.f, 0.f, Canvas->SizeX, Canvas->SizeY);
		DamageFlashAlpha = FMath::Max(0.f, DamageFlashAlpha - 1.4f * GetWorld()->GetDeltaSeconds());
	}
}

void AAV_GameHUD::DrawVowStatus(const AAV_PlayerCharacter* Player)
{
	const UAV_VowComponent* Vow = Player->GetVowComponent();

	FString VowText = Vow->GetEquippedVowDisplayName().ToString();
	const float Cooldown = Vow->GetAbilityCooldownRemaining();
	if (Cooldown > 0.f)
	{
		VowText += FString::Printf(TEXT("  (ability %.1fs)"), Cooldown);
	}

	// To the right of the Vow Energy bar.
	DrawText(VowText, FLinearColor(0.72f, 0.62f, 0.38f), 288.f, 74.f, GEngine->GetSmallFont());
}

void AAV_GameHUD::DrawDialoguePanel(const AAV_PlayerController* PC)
{
	const FString Speaker = PC->GetCurrentDialogueSpeaker().ToString();
	const FString Line = PC->GetCurrentDialogueLineText().ToString();

	// Greedy word-wrap; canvas DrawText has no wrapping of its own.
	TArray<FString> Words;
	Line.ParseIntoArray(Words, TEXT(" "));
	TArray<FString> WrappedLines;
	FString Current;
	for (const FString& Word : Words)
	{
		if (Current.Len() + Word.Len() + 1 > 72 && !Current.IsEmpty())
		{
			WrappedLines.Add(Current);
			Current.Reset();
		}
		Current = Current.IsEmpty() ? Word : Current + TEXT(" ") + Word;
	}
	if (!Current.IsEmpty())
	{
		WrappedLines.Add(Current);
	}

	UFont* Medium = GEngine->GetMediumFont();
	UFont* Large = GEngine->GetLargeFont();

	const float PanelHeight = 96.f + WrappedLines.Num() * 26.f;
	const float PanelY = Canvas->SizeY * 0.78f - PanelHeight * 0.5f;
	const float CenterX = Canvas->SizeX * 0.5f;

	DrawRect(FLinearColor(0.f, 0.f, 0.f, 0.72f),
		Canvas->SizeX * 0.16f, PanelY, Canvas->SizeX * 0.68f, PanelHeight);

	DrawCenteredText(Speaker, CenterX, PanelY + 14.f, FLinearColor(0.72f, 0.62f, 0.38f), Medium, 1.1f);

	float LineY = PanelY + 44.f;
	for (const FString& Wrapped : WrappedLines)
	{
		DrawCenteredText(Wrapped, CenterX, LineY, TextColor, Large, 1.0f);
		LineY += 26.f;
	}

	DrawCenteredText(TEXT("[F]  Continue"), CenterX, PanelY + PanelHeight - 26.f,
		FLinearColor(0.6f, 0.58f, 0.52f), Medium, 0.9f);
}

void AAV_GameHUD::DrawRestingVowList(const AAV_PlayerCharacter* Player)
{
	const UAV_VowComponent* Vow = Player->GetVowComponent();
	const TArray<FAV_VowDefinition> Unlocked = Vow->GetUnlockedVowDefinitions();
	const FName EquippedId = Vow->HasVowEquipped() ? Vow->GetEquippedVow().VowId : NAME_None;

	UFont* Medium = GEngine->GetMediumFont();
	const float CenterX = Canvas->SizeX * 0.5f;
	float Y = Canvas->SizeY * 0.40f;

	const float PanelHeight = 56.f + FMath::Max(1, Unlocked.Num()) * 24.f;
	DrawRect(FLinearColor(0.f, 0.f, 0.f, 0.6f),
		CenterX - 240.f, Y - 14.f, 480.f, PanelHeight);

	DrawCenteredText(TEXT("— Sworn Vows —"), CenterX, Y, FLinearColor(0.72f, 0.62f, 0.38f), Medium, 1.1f);
	Y += 30.f;

	if (Unlocked.Num() == 0)
	{
		DrawCenteredText(TEXT("No Vow fragments remembered."), CenterX, Y, TextColor, Medium, 0.95f);
		return;
	}

	for (int32 Index = 0; Index < Unlocked.Num() && Index < 3; ++Index)
	{
		const bool bEquipped = Unlocked[Index].VowId == EquippedId;
		const FString Entry = FString::Printf(TEXT("[%d]  %s%s"),
			Index + 1,
			*Unlocked[Index].DisplayName.ToString(),
			bEquipped ? TEXT("   — sworn") : TEXT(""));
		DrawCenteredText(Entry, CenterX, Y,
			bEquipped ? FLinearColor(0.85f, 0.75f, 0.45f) : TextColor, Medium, 0.95f);
		Y += 24.f;
	}
}

void AAV_GameHUD::PushNotification(const FText& Message)
{
	FAV_HudNotification Note;
	Note.Text = Message.ToString();
	Note.ExpireTime = GetWorld() ? GetWorld()->GetTimeSeconds() + NotificationDuration : 0.0;
	Notifications.Add(Note);
}

void AAV_GameHUD::DrawNotifications()
{
	if (Notifications.Num() == 0 || !GetWorld())
	{
		return;
	}

	const double Now = GetWorld()->GetTimeSeconds();
	Notifications.RemoveAll([Now](const FAV_HudNotification& Note) { return Note.ExpireTime <= Now; });

	UFont* Medium = GEngine->GetMediumFont();
	const float CenterX = Canvas->SizeX * 0.5f;
	float Y = 110.f;

	for (const FAV_HudNotification& Note : Notifications)
	{
		const float Remaining = static_cast<float>(Note.ExpireTime - Now);
		const float Alpha = FMath::Clamp(Remaining / 0.8f, 0.f, 1.f); // fade out at the end

		float TextW, TextH;
		GetTextSize(Note.Text, TextW, TextH, Medium);
		DrawRect(FLinearColor(0.f, 0.f, 0.f, 0.5f * Alpha),
			CenterX - TextW * 0.5f - 12.f, Y - 6.f, TextW + 24.f, TextH + 12.f);

		FLinearColor NoteColor = TextColor;
		NoteColor.A = Alpha;
		DrawCenteredText(Note.Text, CenterX, Y, NoteColor, Medium, 1.0f);
		Y += TextH + 20.f;
	}
}
