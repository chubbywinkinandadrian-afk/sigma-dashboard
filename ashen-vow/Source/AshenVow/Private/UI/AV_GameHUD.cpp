#include "UI/AV_GameHUD.h"
#include "Characters/AV_PlayerCharacter.h"
#include "Characters/AV_EnemyBase.h"
#include "EngineUtils.h"
#include "Components/AV_HealthComponent.h"
#include "Components/AV_StaminaComponent.h"
#include "Components/AV_LockOnComponent.h"
#include "Components/AV_InteractionComponent.h"
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
		// Top-left vitals.
		DrawBar(40.f, 40.f, 380.f, 16.f, Player->GetHealthComponent()->GetHealthPercent(), HealthColor);
		DrawBar(40.f, 62.f, 300.f, 11.f, Player->GetStaminaComponent()->GetStaminaPercent(), StaminaColor);

		const FString FlaskText = FString::Printf(TEXT("Ashen Flask  %d / %d"),
			Player->GetFlaskCharges(), Player->GetMaxFlaskCharges());
		DrawText(FlaskText, TextColor, 40.f, 84.f, Medium);

		// Ash counter, bottom-right.
		const FString AshText = FString::Printf(TEXT("Ash  %d"), Player->GetAshCount());
		float AshW, AshH;
		GetTextSize(AshText, AshW, AshH, Medium);
		DrawText(AshText, TextColor, Canvas->SizeX - AshW - 48.f, Canvas->SizeY - AshH - 44.f, Medium);

		// Interaction prompt, lower center — large, with a backing panel for readability.
		const FText Prompt = Player->GetInteractionComponent()->GetFocusedPromptText();
		if (!Prompt.IsEmpty())
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
