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

    std::unique_ptr<GoosePublisherWrapper> goosePublisher = std::make_unique<GoosePublisherWrapper>(gooseSettings);

    // One receiver (own RSession/UDP port/receive thread) PER merging unit, standard
    // R-session-per-MU-pair practice. This is also the performance-critical choice: a
    // single receiver thread decrypting AES-GCM for all MUs on one socket saturates at
    // ~7000 pkt/s — two 4000 sa/s streams overflow it (~12% loss, ~20 ms queueing).
    // Per-MU receivers decrypt in parallel; give each MU its own rSessionSettings.port.
    std::vector<std::unique_ptr<SampledValuesSubscriberWrapper>> svSubscribers;
    for (const auto &streamConfig : sampledValuesSettingsArray)
    {
        auto sub = std::make_unique<SampledValuesSubscriberWrapper>(streamConfig);
        sub->addStream(streamConfig, [&goosePublisher](uint16_t appId, bool value)
                       { goosePublisher->PublishMessage(appId, value); });
        svSubscribers.push_back(std::move(sub));
    }

    goosePublisher->Print();
    for (auto &sub : svSubscribers)
    {
        sub->Print();
        sub->Start();
    }

    while (true)
    {
        std::this_thread::sleep_for(std::chrono::seconds(2));
        for (auto &sub : svSubscribers)
            sub->PrintStats(); // per-stream rx/rate/loss/jitter/OWD (liveness)
    }

    return 0;
}
