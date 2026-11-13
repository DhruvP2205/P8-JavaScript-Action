import { parseVersion } from './semver.js';
import * as core from '@actions/core';

function run(){
    try{
        const version = core.getInput("version", { required: true });
        const allowPrefixV = core.getBooleanInput('allow-prefix-v');
        const failOnInvalid = core.getBooleanInput('fail-on-invalid');

        let parseResult = parseVersion(version, {allowPrefixV});

        const reason = parseResult.reason;
        
        core.setOutput('valid', `${parseResult.valid}`);
        core.setOutput('version', `${parseResult.version}`);
        core.setOutput('major', `${parseResult.major ?? ""}`);
        core.setOutput('minor', `${parseResult.minor ?? ""}`);
        core.setOutput('patch', `${parseResult.patch ?? ""}`);
        core.setOutput('prerelease', `${parseResult.prerelease}`);
        core.setOutput('docker-tags', `${parseResult.dockerTags}`);

        core.info(`The job is done. Valid: ${parseResult.valid}`);
        core.info(`----Description----`);
        core.info(`Version: ${parseResult.version}`);
        core.info(`Major: ${parseResult.major ?? ""}`);
        core.info(`Minor: ${parseResult.minor ?? ""}`);
        core.info(`Patch: ${parseResult.patch ?? ""}`);
        core.info(`Pre-Release: ${parseResult.prerelease}`);
        core.info(`Docker Tag: ${parseResult.dockerTags}`);
        core.info(`Reason: ${reason}`);
            

        if(!parseResult.valid){
            if(failOnInvalid){
                core.setFailed(reason);
                return;
            }
            core.warning(reason);
            return;
        }

        core.info("Job Finished!!!");
    } catch(error){
        core.setFailed(`Action failed with error: ${error.message}`);
    }
}

run();