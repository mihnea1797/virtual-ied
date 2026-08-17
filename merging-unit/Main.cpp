#include "goose-publisher/GoosePublisherWrapper.hpp"
#include "sv-subscriber/SampledValuesSubscriberWrapper.hpp"
#include "ButterworthFilter.hpp"
#include "RmsComputationObject.hpp"
#include <memory>
#include <iostream>
#include <fstream>
#include <thread>
#include <chrono>
#include <nlohmann/json.hpp>

int main()
{
    std::ifstream file("/root/virtual-merging-unit/config.json");
    if (!file)
    {
        std::cerr << "Unable to open config file." << std::endl;
        return 1;
    }

    nlohmann::json config;
    file >> config;

    nlohmann::json gooseSettings = config["gooseSettings"];
    if (!gooseSettings.is_array() || gooseSettings.empty())
    {
        std::cerr << "gooseSettings must be a non-empty array in config.json." << std::endl;
        return 1;
    }

    nlohmann::json sampledValuesSettingsArray = config["sampledValuesSettings"];
    if (!sampledValuesSettingsArray.is_array() || sampledValuesSettingsArray.empty())
    {
        std::cerr << "sampledValuesSettings must be a non-empty array in config.json." << std::endl;
        return 1;
    }

    nlohmann::json postgresSqlProperties = config["postgresSql"];

    std::unique_ptr<GoosePublisherWrapper> goosePublisher = std::make_unique<GoosePublisherWrapper>(gooseSettings);

    // One receiver for the shared interface / R-SV session; streams are demultiplexed by appId
    std::unique_ptr<SampledValuesSubscriberWrapper> svSubscriber =
        std::make_unique<SampledValuesSubscriberWrapper>(sampledValuesSettingsArray[0]);
    svSubscriber->setPostgresConnection(postgresSqlProperties);

    for (const auto &streamConfig : sampledValuesSettingsArray)
    {
        svSubscriber->addStream(streamConfig, [&goosePublisher](bool value)
                                { goosePublisher->PublishMessage(value); });
    }

    goosePublisher->Print();
    svSubscriber->Print();
    svSubscriber->Start();

    while (true)
    {
        std::this_thread::sleep_for(std::chrono::seconds(2));
        svSubscriber->PrintStats(); // per-stream rx/rate/loss/jitter (liveness)
    }

    return 0;
}
